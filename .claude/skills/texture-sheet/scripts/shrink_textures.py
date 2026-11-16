#!/usr/bin/env python3
"""Shrink the game's textures by how much surface they cover, to cut GPU memory and bandwidth.

Usage (from the repository root):
  python3 .claude/skills/texture-sheet/scripts/shrink_textures.py [textures/usage.json]

textures/usage.json maps each texture id to the m² it covers in the built world; regenerate it with
scripts/usage.html (see SKILL.md). Pixel count is divided by:
  6  textures covering under 1.5 m² in total (tableware, food, small props, pictures)
  5  textures covering under 6 m²
  3  everything else
The original edge length is kept in the manifest as `fullSize`, so running this again never shrinks
a texture twice; a texture added later is shrunk from its own size.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

RULES = [(1.5, 6), (6.0, 5), (float("inf"), 3)]


def factor_for(m2: float) -> int:
    return next(f for limit, f in RULES if m2 < limit)


def target(full: int, factor: int) -> int:
    return max(32, int(round(full / factor ** 0.5 / 8)) * 8)


def resize_normal(img: Image.Image, size: int) -> Image.Image:
    small = np.asarray(img.convert("RGB").resize((size, size), Image.LANCZOS), dtype=np.float32) / 127.5 - 1
    small /= np.maximum(np.linalg.norm(small, axis=2, keepdims=True), 1e-6)
    return Image.fromarray(((small + 1) * 127.5).clip(0, 255).round().astype(np.uint8), "RGB")


def main() -> None:
    root = Path.cwd()
    usage = json.loads(Path(sys.argv[1] if len(sys.argv) > 1 else "textures/usage.json").read_text())
    manifest_path = root / "textures" / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    before = after = 0
    for tid, entry in manifest["textures"].items():
        factor = factor_for(usage.get(tid, 0.0))
        for key, normal in (("albedo", False), ("normal", True)):
            if not entry.get(key):
                continue
            path = root / "textures" / entry[key]
            img = Image.open(path)
            full = entry.setdefault("fullSize", {}).setdefault(key, img.width)
            size = target(full, factor)
            before += full * full
            after += size * size
            if img.width <= size:
                continue
            small = resize_normal(img, size) if normal else img.convert("RGB").resize((size, size), Image.LANCZOS)
            small.save(path, quality=90, method=6)
        entry["shrink"] = factor
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"pixels: {before:,} -> {after:,} ({before / max(after, 1):.2f}x less)")


if __name__ == "__main__":
    main()
