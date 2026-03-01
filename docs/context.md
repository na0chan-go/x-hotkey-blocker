# プロジェクト経緯と現在コンテキスト

最終更新日: 2026-03-02

## 目的
Chrome系ブラウザ拡張機能として、Xのポスト上でショートカット操作により投稿者を素早くブロックできるようにする。

- macOS: `Command + 左クリック`
- Windows/Linux: `Ctrl + 左クリック`

## 命名経緯
- 初期フォルダ名: `left-blocker`（仮）
- 現在の正式名: `x-hotkey-blocker`
- GitHubリポジトリ: `na0chan-go/x-hotkey-blocker`

## 現在の実装状況
- Manifest V3 のひな形を作成済み
- `x.com` / `twitter.com` に `content.js` を注入
- `Cmd/Ctrl + 左クリック` をフック
- 実行結果トーストを表示（成功/スキップ/失敗）
- 拡張ポップアップで ON/OFF 切り替え（`chrome.storage.local`）
- 拡張ポップアップで二段階確認 ON/OFF 切り替え（`requireConfirm`）
- 二段階確認ON時: 同じポストを3秒以内に再クリックした時だけ実行
- 二段階確認OFF時: 1回のクリックで実行
- ポストメニューに `Unfollow / フォロー解除` がある場合はブロックをスキップ
- 実行履歴を `executionHistory` に保存（最大30件）し、popupで直近10件を表示

## 配布運用
- `npm run pack:extension` で配布用zipを生成
- 出力: `dist/x-hotkey-blocker-v<manifest_version>.zip`
- Releaseにzipを添付すれば、開発者以外にも導入手順を案内しやすい

## テスト基盤
- Playwright を導入
- `npm run test:e2e` で popup UI のE2Eを実行
- 現在のE2E対象:
  - 初期トグル表示
  - 履歴表示
  - トグル変更時のステータス表示更新
- テストファイル: `tests/e2e/popup.spec.js`
- 設定ファイル: `playwright.config.js`

対象ファイル:
- `manifest.json`
- `content.js`
- `popup.html`
- `popup.js`
- `README.md`

## 運用ルール
- コミットメッセージは日本語で記載する
- GitHub Issueは日本語で記載する
- 仕様変更や判断理由は `docs/` に追記して、コンテキスト圧縮後も復元可能にする

## 既知の注意点
- X側のDOMや文言変更により、セレクタが無効化される可能性がある
- `Unfollow` 文言検出ベースのため、多言語UIで追加調整が必要になる場合がある
