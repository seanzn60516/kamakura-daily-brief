# 📋 デイリーブリーフ (kamakura-daily-brief)

毎朝7:30(JST)に、以下の内容をまとめたページを自動生成し、GitHub Pagesで公開、
リンク付きメールを自動送信する個人用アプリです。

- 📈 投資ピックアップ(市場全体からの注目情報、Claude APIのWeb検索で生成)
- 🗑 今日のゴミ出し(鎌倉市植木地区 ※現在は仮データ、要差し替え)
- 👶 新生児の育て方tips
- ✨ スキンケアtips

---

## 仕組み

```
GitHub Actions (毎日22:30 UTC = 7:30 JST)
  → scripts/generate.mjs が Claude API を呼び出しコンテンツ生成
  → docs/index.html を生成・コミット(GitHub Pagesで自動公開)
  → scripts/send-email.mjs が Gmail経由でリンク付きメールを送信
```

---

## セットアップ手順

### 1. このリポジトリをGitHubにアップロード

1. GitHubで新規リポジトリを作成(例: `kamakura-daily-brief`)
2. このフォルダの中身をそのままpush

```bash
cd kamakura-daily-brief
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/<あなたのユーザー名>/kamakura-daily-brief.git
git push -u origin main
```

### 2. GitHub Pagesを有効化

1. リポジトリの `Settings` → `Pages`
2. `Source` を `Deploy from a branch` に設定
3. `Branch` を `main` / `docs` フォルダに設定して保存
4. 公開URLが `https://<ユーザー名>.github.io/kamakura-daily-brief/` の形式で発行されます
   → このURLを後でSecretsの `PAGES_URL` に設定します

### 3. Claude APIキーを取得

1. https://console.anthropic.com/ でアカウント作成
2. APIキーを発行(`sk-ant-...`という文字列)
3. 少額のクレジットをチャージ(1日1回の生成なら月100円未満で足ります)

### 4. Gmailのアプリパスワードを発行

1. Googleアカウントで2段階認証を有効化(必須)
2. https://myaccount.google.com/apppasswords にアクセス
3. 「アプリパスワード」を発行(16桁の文字列が発行されます)
4. これは普段のGmailパスワードとは別物です。この16桁を使います

### 5. GitHubにSecretsを登録

リポジトリの `Settings` → `Secrets and variables` → `Actions` → `New repository secret` で以下を登録:

| Secret名 | 内容 |
|---|---|
| `ANTHROPIC_API_KEY` | Claude APIキー |
| `GMAIL_USER` | 送信元Gmailアドレス |
| `GMAIL_APP_PASSWORD` | 手順4で発行した16桁のアプリパスワード |
| `TO_EMAIL` | 通知を受け取りたいメールアドレス(自分宛でOK) |
| `PAGES_URL` | 手順2で発行されたGitHub PagesのURL |

### 6. 動作確認

1. リポジトリの `Actions` タブ → `Daily Brief` → `Run workflow` で手動実行
2. 数十秒〜1分程度でメールが届けば成功
3. 届かない場合は `Actions` タブのログでエラー内容を確認

これで毎日7:30(JST)に自動実行されます。

---

## ⚠️ 今後やること(TODO)

- [ ] `scripts/trash-schedule.mjs` を鎌倉市植木地区の**正確な収集曜日**に差し替える
      (現在は全て仮データです。公式カレンダーPDFで確認してください)
      参考: https://www.city.kamakura.kanagawa.jp/gomi/chikubetsu.html
- [ ] 投資ピックアップの生成プロンプトを好みに応じて調整(scripts/generate.mjs の `PROMPT`)
- [ ] 育児・スキンケアtipsの切り口を好みに応じて調整

## 免責事項

投資情報は情報提供を目的としたものであり、投資助言ではありません。
投資判断は自己責任で行ってください。
