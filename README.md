# x-hotkey-blocker

Chrome系ブラウザ向けの拡張機能です。X (x.com / twitter.com) 上で以下ショートカットを押しながらポストを左クリックすると、投稿者のブロックを試行します。

- macOS: `Command + 左クリック`
- Windows/Linux: `Ctrl + 左クリック`

## UX仕様

- 実行結果トースト: `実行成功 / フォロー中のためスキップ / 失敗` を画面右下に表示
- ON/OFFトグル: 拡張アイコンのポップアップで有効・無効を切り替え可能
- 二段階確認トグル:
  - ON: 最初のクリックでは実行せず、3秒以内に同じポストを再クリックした時だけ実行
  - OFF: 1回のクリックで即実行
- フォロー中除外: ポストメニュー内に `Unfollow / フォロー解除` がある場合はスキップ
- 実行履歴パネル: ポップアップに直近10件（内部保持30件）の実行結果を表示

## 誰でも使う手順（推奨）

最新版の配布ページ:
- https://github.com/na0chan-go/x-hotkey-blocker/releases/latest

手順:
1. Releaseページから `x-hotkey-blocker-v*.zip` をダウンロード
2. zipを展開して任意フォルダに置く
3. Chromeで `chrome://extensions` を開く
4. 右上の「デベロッパーモード」をON
5. 「パッケージ化されていない拡張機能を読み込む」で展開フォルダを選択

## 開発者向けセットアップ

1. このリポジトリをローカルで開く
2. Chromeで `chrome://extensions` を開く
3. 右上の「デベロッパーモード」をON
4. 「パッケージ化されていない拡張機能を読み込む」でこのフォルダを選択
5. ソース変更時は拡張機能カードの「更新」を押してから、Xタブを再読み込み

## 配布用zipの作成

- 実行: `npm run pack:extension`
- 出力先: `dist/x-hotkey-blocker-v<manifest_version>.zip`
- 含まれるファイル: `manifest.json`, `content.js`, `popup.html`, `popup.js`

## E2Eテスト

1. 依存関係をインストール: `npm install`
2. テスト実行: `npm run test:e2e`

現在は popup UI を対象に、以下を Playwright で検証しています。

- 初期状態でトグルがON表示される
- 履歴データが一覧表示される
- トグル変更でステータス表示が更新される

## ファイル構成

- `manifest.json`: Manifest V3設定（`storage` 権限 / popup設定含む）
- `content.js`: ホットキー検出、二段階確認、ブロック処理、トースト通知、履歴保存
- `popup.html`, `popup.js`: ON/OFF と二段階確認ON/OFF の切り替え、履歴表示UI
- `scripts/pack-extension.sh`: 配布用zip作成スクリプト
- `tests/e2e/popup.spec.js`: popup UI の E2E テスト
- `playwright.config.js`: Playwright 設定

## 注意点

- Chrome Web Store未公開のため、現時点では手動インストールが必要です。
- XのDOM/文言が変わると動作しなくなる可能性があります。
- `Unfollow` 文言検出ベースのため、多言語UIでは追加調整が必要になる場合があります。
