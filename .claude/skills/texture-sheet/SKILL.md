---
name: texture-sheet
description: Generate textures for the STRATA B4 game with OpenAI GPT Image 2.5 Sunburst. One 1:1 image at the largest size (2880x2880), quality medium, holds a 3x3 grid of 9 materials; the script slices it into 9 seamless tiles with normal maps and registers them in textures/manifest.json so the game can use them. Use when asked to generate, add or redo game textures ("テクスチャを生成", "画像生成して追加").
---

# texture-sheet: 3x3 テクスチャシート生成スキル

GPT Image 2.5 Sunburst（`gpt-image-2.5-sunburst`）で 1:1・最大サイズ 2880×2880・品質 medium の画像を1枚生成し、
3×3 のマスに描かせた9種類の素材を切り出してゲーム用テクスチャにします。

- 1枚 = 9種類。18種類なら2枚、36種類なら4枚、72種類なら8枚。
- 既定の品質は `medium`（最大解像度のミディアム）。仕様ファイルの `"quality"` で `low` / `medium` / `high` / `xhigh` / `max` に変えられる。
- 切り出したテクスチャの既定サイズは 1024px（`tileSize`）、ノーマルマップは 512px（`normalSize`）。
- 2880×2880 は gpt-image-2.5 の上限（総画素数 8,294,400、16の倍数）で、3で割ると1マス 960px。

## API キー

キーはリポジトリに絶対に書かない。環境変数で渡す。

```bash
export OPENAI_API_KEY=sk-...            # または
export OPENAI_API_KEY_FILE=/path/to/key # キーだけを書いたファイル（リポジトリの外に置く）
```

## 手順

1. `textures/specs/<sheet-id>.json` を作る（形式は下記）。マスは必ず9個。
2. 生成して切り出す（リポジトリのルートで実行）:

   ```bash
   python3 .claude/skills/texture-sheet/scripts/texture_sheet.py all textures/specs/<sheet-id>.json
   # 複数シートを一度に（生成は最大8枚まで並列、切り出しは順番に）
   python3 .claude/skills/texture-sheet/scripts/texture_sheet.py all textures/specs/facility-*.json textures/specs/detail-*.json
   ```

   - `generate` だけ、`slice` だけ、`prompt`（送るプロンプトを表示するだけ）も使える。
   - 混雑（429/5xx）は自動で再試行する。`insufficient_quota`（クレジット切れ）は再試行せずすぐ止まるので、
     OpenAI の Billing でクレジットを追加してから同じコマンドをもう一度実行する。
3. `textures/sheets/<sheet-id>.webp`（縮小プレビュー）を見て、3×3 が崩れていないか、文字が入っていないかを確認する。
4. 2×2 に並べて継ぎ目が出ていないか確認する。規則的な模様（縞・格子）は、周期に合わせて切り出し位置を自動調整している。
5. ゲームに組み込む（下記）。

生画像（約15〜18MB）は `textures/_raw/` に保存され、`.gitignore` で除外される。

## 仕様ファイルの形式

```json
{
  "id": "cavern-architecture",
  "title": "表示用の名前",
  "quality": "medium",
  "tileSize": 512,
  "normalSize": 512,
  "theme": "シート全体の雰囲気（英語）",
  "cells": [
    {"id": "cave-basalt", "name": "空洞の玄武岩", "meters": 3,
     "roughness": 0.92, "metalness": 0, "normalStrength": 2.2,
     "prompt": "dark wet basalt cave rock wall ..., about 3 m across"}
  ]
}
```

マスの任意項目:

| 項目 | 意味 |
|---|---|
| `meters` | テクスチャ1枚が表す実寸（m）。UV の繰り返し回数の計算に使う |
| `seamless` | `false` で継ぎ目処理をしない（絵・計器盤など1枚もの）。`"x"` で横方向だけ |
| `emissive` | 発光の強さ（光る結晶、障子、画面など） |
| `targets` | 既存の glTF マテリアル名の配列。指定すると、その素材の模様を自動で差し替える |
| `normalStrength` | 明るさから作るノーマルマップの強さ。`0` で作らない |
| `tone` | 色の仕上げ（既定 `{"saturation":0.86,"contrast":0.9,"lift":0.035}`）。濃すぎ・暗すぎを防ぐ。`false` で無効。シート全体にも書ける |

プロンプトのコツ: 「真上から／正面から」「about N m across」を書く。色は濃くしすぎず「soft muted natural colours, moderate contrast」を添える。文字が出やすい物（看板、本、画面）には
`no text, no letters, no numbers` を必ず入れる。

## 出力とゲームへの組み込み

- `textures/<id>.webp`（色）、`textures/<id>-normal.webp`（ノーマル）、`textures/manifest.json`（一覧）。
- 既存素材の差し替え: マスに `targets` を書くだけ。`textures.js` の `applyRetexture` が読み込み時に自動で適用する。
- 新しい物に使う: `kit.js` の `kit.tex('<id>')` でマテリアルを取り出し、`cavern.js` / `quarters.js` / `surface.js` / `details.js` で形を作る。
- 単色だった素材をテクスチャに置き換えるときは、`kit.js` の `PLAIN` に「テクスチャ id → 元の単色」を書く。テクスチャがまだ無い間は元の見た目のまま動く。
- `details.js` の作り込み用の物は、テクスチャが無い間は `FALLBACK` の色で表示される。
- 配置・当たり判定・床の高さは `cavern-layout.js` にまとめてある。
- 確認はローカルサーバー（`python3 -m http.server`）でゲームを開いて行う。
