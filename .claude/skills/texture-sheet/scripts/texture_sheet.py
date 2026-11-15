#!/usr/bin/env python3
"""Generate a 3x3 texture sheet with GPT Image 2.5 Sunburst and slice it into 9 game textures.

Usage (from the repository root):
  python3 .claude/skills/texture-sheet/scripts/texture_sheet.py generate textures/specs/<sheet>.json
  python3 .claude/skills/texture-sheet/scripts/texture_sheet.py slice    textures/specs/<sheet>.json
  python3 .claude/skills/texture-sheet/scripts/texture_sheet.py all      textures/specs/<sheet>.json

The API key is read from the OPENAI_API_KEY environment variable, or from the file named by
OPENAI_API_KEY_FILE. It is never written anywhere.
"""
from __future__ import annotations

import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

API_URL = os.environ.get("OPENAI_IMAGES_URL", "https://api.openai.com/v1/images/generations")

DEFAULTS = {
    "model": "gpt-image-2.5-sunburst",
    # 1:1 at the largest size the model accepts: 2880*2880 = 8,294,400 px (the documented cap),
    # a multiple of 16, and divisible by 3 -> 960 px per cell.
    "size": "2880x2880",
    "quality": "xhigh",
    "tileSize": 1024,      # albedo output size (px)
    "normalSize": 512,     # normal map output size (px)
    "inset": 16,           # px trimmed from every cell edge (removes bleed from neighbours)
    "blend": 80,           # px cross-faded to make each cell tile seamlessly
}

SHEET_PROMPT = """A single square image divided into an exact 3x3 grid of nine square texture swatches \
for a realistic 3D video game ({theme}).
Strict layout rules:
- Exactly 3 columns and 3 rows; every swatch is exactly one third of the image width and height.
- Swatches touch edge to edge: no borders, no gutters, no gaps, no frames, no drop shadows.
- No text, no letters, no numbers, no labels, no logos, no watermarks anywhere.
- Every swatch is a flat, orthographic, straight-on photograph of a material surface that fills \
its whole cell, lit evenly with soft diffuse light: no perspective, no vignette, no strong \
highlights, no cast shadows, no objects in front of the surface.
- Every swatch is a seamless, tileable PBR albedo texture with uniform detail across the cell.

The nine swatches, row by row, left to right:
{cells}"""


def load_spec(path: Path) -> dict:
    spec = json.loads(path.read_text(encoding="utf-8"))
    if len(spec.get("cells", [])) != 9:
        sys.exit(f"{path}: a sheet needs exactly 9 cells, found {len(spec.get('cells', []))}")
    return {**DEFAULTS, **spec}


def repo_root() -> Path:
    here = Path.cwd()
    for p in [here, *here.parents]:
        if (p / ".git").exists():
            return p
    return here


def build_prompt(spec: dict) -> str:
    rows = ["top", "middle", "bottom"]
    cols = ["left", "center", "right"]
    lines = []
    for i, cell in enumerate(spec["cells"]):
        lines.append(f"{i + 1}. ({rows[i // 3]} {cols[i % 3]}) {cell['prompt']}")
    return SHEET_PROMPT.format(theme=spec["theme"], cells="\n".join(lines))


def api_key() -> str:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key and os.environ.get("OPENAI_API_KEY_FILE"):
        key = Path(os.environ["OPENAI_API_KEY_FILE"]).read_text(encoding="utf-8").strip()
    if not key:
        sys.exit("Set OPENAI_API_KEY (or OPENAI_API_KEY_FILE) before generating.")
    return key


def generate(spec_path: Path) -> Path:
    spec = load_spec(spec_path)
    root = repo_root()
    raw_dir = root / "textures" / "_raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    prompt = build_prompt(spec)
    body = {
        "model": spec["model"],
        "prompt": prompt,
        "size": spec["size"],
        "quality": spec["quality"],
        "n": 1,
        "output_format": "png",
    }
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {api_key()}", "Content-Type": "application/json"},
    )
    print(f"[{spec['id']}] requesting {spec['model']} {spec['size']} quality={spec['quality']} ...", flush=True)
    started = time.time()
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=1200) as r:
                data = json.loads(r.read())
            break
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:2000]
            if e.code in (429, 500, 502, 503, 504) and attempt < 4:
                wait = 20 * (attempt + 1)
                print(f"[{spec['id']}] API {e.code}, retrying in {wait}s: {detail[:200]}", flush=True)
                time.sleep(wait)
                continue
            sys.exit(f"[{spec['id']}] API error {e.code}: {detail}")
    item = data["data"][0]
    if item.get("b64_json"):
        png = base64.b64decode(item["b64_json"])
    else:
        with urllib.request.urlopen(item["url"], timeout=300) as r:
            png = r.read()
    out = raw_dir / f"{spec['id']}.png"
    out.write_bytes(png)
    meta = {k: data.get(k) for k in ("created", "usage", "size", "quality", "output_format") if k in data}
    meta.update({"model": spec["model"], "requestSize": spec["size"], "requestQuality": spec["quality"],
                 "seconds": round(time.time() - started, 1), "prompt": prompt})
    (raw_dir / f"{spec['id']}.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[{spec['id']}] saved {out} ({len(png)} bytes, {meta['seconds']} s)", flush=True)
    return out


# ---------- slicing ----------

def best_period(a: np.ndarray, blend: int) -> int:
    """Pick the tile length S whose wrap-around strip a[S:S+blend] best matches a[0:blend].

    For regular patterns (stripes, grating, vents, seams) this lands on a whole number of
    pattern repeats, so the cross-fade below joins matching content instead of ghosting it.
    Lengths of at least 80% of the cell are preferred; a shorter one (down to 50%) is used
    only when it matches clearly better, as with wide diagonal stripes.
    """
    n = a.shape[0]
    g = a.mean(axis=2) if a.ndim == 3 else a
    head = g[:blend]
    errs = {s: float(np.mean(np.abs(g[s:s + blend] - head))) for s in range(n // 2, n - blend + 1)}
    preferred = min((s for s in errs if s >= int(n * 0.8)), key=errs.get)
    overall = min(errs, key=errs.get)
    return overall if errs[overall] < 0.7 * errs[preferred] else preferred


def make_seamless(cell: np.ndarray, blend: int, axes: str = "xy") -> np.ndarray:
    """Cross-fade the overlap so the tile wraps without seams (separable: x then y)."""
    def along(a: np.ndarray, axis: int) -> np.ndarray:
        a = np.moveaxis(a, axis, 0)
        n = a.shape[0]
        s = best_period(a, blend)
        w = np.linspace(0.0, 1.0, blend, dtype=np.float32)
        w = w * w * (3 - 2 * w)  # smoothstep
        w = w.reshape(-1, *([1] * (a.ndim - 1)))
        out = a[:s].copy()
        out[:blend] = a[:blend] * w + a[s:s + blend] * (1 - w)
        return np.moveaxis(out, 0, axis)
    if "x" in axes:
        cell = along(cell, 1)
    if "y" in axes:
        cell = along(cell, 0)
    return cell


def normal_from_albedo(img: Image.Image, size: int, strength: float) -> Image.Image:
    g = np.asarray(img.convert("L").resize((size, size), Image.LANCZOS), dtype=np.float32) / 255.0
    g = np.asarray(Image.fromarray((g * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)),
                   dtype=np.float32) / 255.0
    dx = (np.roll(g, -1, axis=1) - np.roll(g, 1, axis=1)) * 0.5
    dy = (np.roll(g, -1, axis=0) - np.roll(g, 1, axis=0)) * 0.5
    k = strength * size / 64.0
    # OpenGL convention (three.js): +X right, +Y up in texture space; image rows grow downward.
    n = np.dstack([-dx * k, dy * k, np.ones_like(g)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return Image.fromarray(((n * 0.5 + 0.5) * 255).round().astype(np.uint8), "RGB")


def slice_sheet(spec_path: Path) -> None:
    spec = load_spec(spec_path)
    root = repo_root()
    raw = root / "textures" / "_raw" / f"{spec['id']}.png"
    if not raw.exists():
        sys.exit(f"{raw} not found: run `generate` first")
    sheet = Image.open(raw).convert("RGB")
    w, h = sheet.size
    tex_dir = root / "textures"
    (tex_dir / "sheets").mkdir(parents=True, exist_ok=True)
    preview = sheet.resize((1024, 1024), Image.LANCZOS)
    preview.save(tex_dir / "sheets" / f"{spec['id']}.webp", quality=82, method=6)

    manifest_path = tex_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    manifest.setdefault("sheets", {})
    manifest.setdefault("textures", {})
    meta_path = raw.with_suffix(".json")
    meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
    manifest["sheets"][spec["id"]] = {
        "model": spec["model"], "size": f"{w}x{h}", "quality": spec["quality"],
        "preview": f"sheets/{spec['id']}.webp",
        "textures": [c["id"] for c in spec["cells"]],
        **({"usage": meta["usage"]} if meta.get("usage") else {}),
    }

    for i, cell in enumerate(spec["cells"]):
        r, c = divmod(i, 3)
        x0, x1 = round(c * w / 3), round((c + 1) * w / 3)
        y0, y1 = round(r * h / 3), round((r + 1) * h / 3)
        inset = spec["inset"]
        crop = np.asarray(sheet.crop((x0 + inset, y0 + inset, x1 - inset, y1 - inset)), dtype=np.float32)
        seamless = cell.get("seamless", True)
        axes = seamless if isinstance(seamless, str) else "xy"
        tile = make_seamless(crop, spec["blend"], axes) if seamless else crop
        img = Image.fromarray(tile.clip(0, 255).round().astype(np.uint8), "RGB")
        img = img.resize((spec["tileSize"], spec["tileSize"]), Image.LANCZOS)
        albedo = f"{cell['id']}.webp"
        img.save(tex_dir / albedo, quality=92, method=6)
        entry = {"name": cell.get("name", cell["id"]), "sheet": spec["id"], "cell": i,
                 "albedo": albedo, "roughness": cell.get("roughness", 0.8),
                 "metalness": cell.get("metalness", 0.0)}
        if cell.get("normalStrength", 1.0) > 0:
            normal = f"{cell['id']}-normal.webp"
            normal_from_albedo(img, spec["normalSize"], cell.get("normalStrength", 1.0)).save(
                tex_dir / normal, quality=92, method=6)
            entry["normal"] = normal
        for key in ("meters", "emissive", "targets"):
            if cell.get(key):
                entry[key] = cell[key]
        manifest["textures"][cell["id"]] = entry
        print(f"[{spec['id']}] cell {i} -> textures/{albedo}")

    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[{spec['id']}] updated {manifest_path.relative_to(root)}")


def main() -> None:
    if len(sys.argv) != 3 or sys.argv[1] not in {"generate", "slice", "all", "prompt"}:
        sys.exit(__doc__)
    cmd, spec_path = sys.argv[1], Path(sys.argv[2])
    if cmd == "prompt":
        print(build_prompt(load_spec(spec_path)))
        return
    if cmd in {"generate", "all"}:
        generate(spec_path)
    if cmd in {"slice", "all"}:
        slice_sheet(spec_path)


if __name__ == "__main__":
    main()
