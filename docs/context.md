# プロジェクト経緯と現在コンテキスト

最終更新日: 2026-03-01

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
- 二段階確認: 同じポストを3秒以内に再クリックした時だけ実行
- 実行結果トーストを表示（成功/スキップ/失敗）
- 拡張ポップアップで ON/OFF 切り替え（`chrome.storage.local`）
- ポストメニューに `Unfollow / フォロー解除` がある場合はブロックをスキップ

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
