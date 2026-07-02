<!-- このファイルはプロジェクト固有ルールのみを書く。個人/グローバル AI ルール
（言語・確認スタイル・出力フォーマット等）は各 AI ツールのグローバル設定へ。
fresh public clone でも有効な内容に保つこと。 -->

# Tab Title Prefix 開発ガイド

## プロジェクト概要

<!-- TODO: 1〜2 段落で、このプロジェクトが何で、誰のためのもので、何を解決するかを書く。
README から重複してでも、AI が常時ロードして思考の前提にできる粒度で。 -->

Firefox の Multi-Account Containers で複数アカウントを同時に開いた際、タブタイトルが同じで見分けがつかない問題を解決するブラウザ拡張。タブタイトルの先頭にコンテナ名（Phase 1・Firefox）や URL ルール別プレフィックス（Phase 2・Chrome 対応）を自動で差し込む。詳細は `docs/local/plan_mvp.md` を参照。

## やらないこと（スコープ外）

<!-- TODO: 「機能追加の打診」を AI から防ぐため、明示的に切り捨てている範囲を列挙する。
例: GUI / exe 化 / 複数 DB 対応 / 自動アップデート / 多言語 UI 等。 -->

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

<!-- TODO: ルート直下の主要フォルダ・ファイルを 1 行解説付きで列挙する。
詳細は別ドキュメントに譲ってよい。 -->

- `docs/local/` — 計画・設計ドキュメント（`plan_mvp.md` が正典・非公開）
- `src/extension/` — 拡張本体（manifest.json / content.js / service_worker.js / options.html・js）※ Phase 1 実装時に作成

## 主要コマンド

<!-- TODO: 開発・テスト・ビルドのよく使うコマンドを 1 行ずつ。
例:
- 開発サーバ: `pnpm dev`
- テスト: `pnpm test`
- 型チェック: `pnpm typecheck`
-->

- Firefox に一時読み込み: `about:debugging` → 「一時的なアドオンを読み込む」→ `src/extension/manifest.json`

## 運用ルール（このプロジェクト固有）

グローバル `~/.claude/CLAUDE.md` の規約（md 命名・フッター・ビルド/コミット抑制・承認フォーマット等）に従う。加えて Tab Title Prefix 固有:

- Phase 1 は Firefox のみに絞る。Chrome 対応・URL ルール機能は Phase 2（`docs/local/plan_mvp.md` C4/C5）まで持ち込まない
- 内部データ構造は最初から「ルールの配列」で持ち、Phase 2 拡張を見据える
- **本リポジトリへのコミット・ビルド・公開はユーザー指示があるまで実行しない**（house 標準）

## secrets-scan (kb-first・4 層防御の一次防御)

公開ファイル（`README*` / `CLAUDE.md` / `AGENTS.md` / `src/**` / `dist/**` / packaged tarball）を新規作成・大改訂する瞬間、以下を AI 自身の責務として実行する:

- 親 plan / 設計メモ / 動作確認ログからの文言転記時、外部 KB の表示名列（`companies.short_name` / `people.name` / `servers.host` / `applications.name`）と family display 名を必ず一般化する（「特定の顧客」「ユーザー」「A 拠点」等）
- テスト fixture / 例示 / サンプルには動作確認の実値を貼らない（最初から合成データで書く）
- 不安なら手で `node scripts/secrets-scan.mjs --staged --block` を実行して検証

機械的な層: layer 2 pre-commit hook（husky or `.githooks/`）/ layer 3 GitHub Actions `secrets-scan.yml` / layer 4 release ゲートが自動で走るが、**書く瞬間の自問が一次防御**。

env (full coverage に必要・未設定なら構造 regex のみで継続): `KB_ROOT` / `FAMILY_ROOT`。設定詳細は `~/.claude/local-accounts.md` または `scripts/secrets-scan.mjs` の冒頭コメント。

参照実装・設計詳細: `worklog-bridge` リポの `docs/local/secrets-scan-design/`（gitignored・公開しない）

## 関連ドキュメント

| 項目 | パス |
|---|---|
| ユーザー向け README | `README.md` |
| Codex/他 AI 用入口 | `AGENTS.md` |
| プロジェクト計画 | `docs/local/plan_mvp.md` |
| ローカル作業ノート（非公開） | `docs/local/`（存在する場合） |
