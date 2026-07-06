<!-- このファイルはプロジェクト固有ルールのみを書く。個人/グローバル AI ルール
（言語・確認スタイル・出力フォーマット等）は各 AI ツールのグローバル設定へ。
fresh public clone でも有効な内容に保つこと。 -->

# Tab Title Prefix 開発ガイド

## プロジェクト概要

Firefox の Multi-Account Containers で複数アカウントを同時に開いた際、タブタイトルが同じで見分けがつかない問題を解決するブラウザ拡張。タブタイトルの先頭にコンテナ名（Phase 1・Firefox）や URL ルール別プレフィックス（Phase 2・Chrome 対応）を自動で差し込む。詳細は `docs/local/plan_mvp.md` を参照。

## やらないこと（スコープ外）

- MV2 対応（両ブラウザ MV3 移行済みのため不要）
- モバイル Firefox 対応（Multi-Account Containers 自体が対象外）
- 多言語化（MVP は英語 + 日本語のみ）
- webextension-polyfill / TypeScript / bundler の導入（規模が小さいうちは vanilla JS + MV3 のみ）
- 有料化・寄付導線

## 技術スタック

| 項目 | 内容 |
|---|---|
| 言語 | vanilla JavaScript |
| 拡張仕様 | Manifest V3 |
| 対象ブラウザ | Firefox（Phase 1）→ Firefox + Chrome（Phase 2） |
| ビルド | 素の PowerShell/Shell スクリプト（bundler 不使用） |

## ディレクトリ構成

- `docs/local/` — 計画・設計ドキュメント（`plan_mvp.md` が正典・非公開）
- `src/extension/` — 拡張本体（manifest.json / content.js / service_worker.js / options.html・js / _locales / img）※ Phase 1 実装済み（v0.1.0 を AMO 提出済み）

## 主要コマンド

- Firefox に一時読み込み: `about:debugging` → 「一時的なアドオンを読み込む」→ `src/extension/manifest.json`
- AMO 提出用 xpi 生成: `pwsh scripts/build_firefox.ps1`（`dist/` に出力・gitignored）
- 構文チェック: `Get-ChildItem src/extension/*.js | ForEach-Object { node --check $_.FullName }`（PowerShell。glob は node 側で展開されないため個別に渡す）
- secrets-scan 手動実行: `node scripts/secrets-scan.mjs --staged --block`

## AI 作業共通ルール

ビルド・コミット禁止、secrets-scan 責務、plan/bugfix/pending md の作成ルール等の AI 作業共通ルールは、各利用者のグローバル AI 設定に従う（作者環境の例: `~/.claude/CLAUDE.md` および `~/.claude/guides/`）。

## 運用ルール（このプロジェクト固有）

- Phase 1 は Firefox のみに絞る。Chrome 対応・URL ルール機能は Phase 2（`docs/local/plan_mvp.md` C4/C5）まで持ち込まない
- 内部データ構造は最初から「ルールの配列」で持ち、Phase 2 拡張を見据える
- secrets-scan の手動実行は `node scripts/secrets-scan.mjs --staged --block`（layer 2 pre-commit hook / layer 3 GitHub Actions `secrets-scan.yml` 配線済み）
- secrets-scan の full coverage には env `KB_ROOT` / `FAMILY_ROOT` が必要（未設定なら構造 regex のみで継続。設定詳細は `scripts/secrets-scan.mjs` の冒頭コメント）

## 関連ドキュメント

| 項目 | パス |
|---|---|
| ユーザー向け README | `README.md` |
| Codex/他 AI 用入口 | `AGENTS.md` |
| プロジェクト計画 | `docs/local/plan_mvp.md` |
| ローカル作業ノート（非公開） | `docs/local/`（存在する場合） |
