# SNS Manager — AIキャラクター SNS 運用支援システム

AIが生成したキャラクターを使った SNS アカウント（X / Instagram）の投稿管理・予約・分析を行う Web 管理ツールです。

---

## 機能一覧

| 機能 | 説明 |
|------|------|
| 投稿管理 | 下書き・予約・投稿済みの CRUD 管理 |
| キャプション生成補助 | ジャンル別テンプレートから複数案を提案 |
| 予約投稿 | 指定時刻に「確認待ち」へ自動昇格（半自動） |
| 投稿確認フロー | ユーザーが確認ボタンを押すまで実際には送信しない |
| 投稿カレンダー | 月表示で予定・投稿済みを一覧 |
| 分析 | いいね・RT・IMP 等を手入力し、グラフで集計 |
| 安全チェック | 禁止ワード・未成年表現・スパムパターンを自動検出 |

---

## セットアップ手順

### 1. 前提条件

- Node.js 18 以上（[https://nodejs.org/](https://nodejs.org/)）
- npm（Node.js に付属）

### 2. 依存パッケージのインストール

```bash
cd sns-manager
npm install
```

### 3. データベースの初期化

```bash
npm run db:push
```

`prisma/dev.db` が作成されます。

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開くと管理画面が表示されます。

---

## 画面構成

```
/ (ダッシュボード)
  - 投稿ステータス統計
  - 確認待ち投稿キュー（承認/却下ボタン付き）
  - 直近投稿一覧

/posts (投稿一覧)
  - ステータスフィルタ
  - 編集・削除

/posts/new (新規投稿作成)
  - タイトル・キャプション・メディアパス・ハッシュタグ入力
  - ジャンル別キャプション提案
  - リアルタイム安全チェック
  - 投稿予約日時設定

/posts/[id]/edit (投稿編集)

/calendar (投稿カレンダー)
  - 月別カレンダー表示

/analytics (分析)
  - 投稿別エンゲージメント入力
  - ジャンル別・時間帯別グラフ
```

---

## 予約投稿の仕組み

```
投稿作成 (SCHEDULED)
    ↓ スケジューラー (1分ごとにバックグラウンドで確認)
確認待ち (PENDING_CONFIRMATION)  ← ダッシュボードに表示
    ↓ ユーザーが「投稿する」ボタンをクリック
投稿済み (POSTED)
```

> **現在の動作：** 実際の API（X / Instagram）には送信せず、ログ出力のみ行うシミュレーション動作です。API 連携を追加すれば本番投稿が可能になります。

---

## X (Twitter) API 設定手順

### 1. Developer Portal でアプリを作成

1. [https://developer.twitter.com/en/portal/dashboard](https://developer.twitter.com/en/portal/dashboard) にアクセスし、プロジェクトとアプリを作成します。
2. アプリの **User authentication settings** を開き、以下を設定:
   - **App permissions**: `Read and Write`
   - **Type of App**: `Web App, Automated App or Bot`
   - **Callback URI / Redirect URL**: 任意（例: `http://localhost:3000/callback`）
   - **Website URL**: 任意（例: `http://localhost:3000`）
3. **Keys and Tokens** タブから以下の値を取得します:

| 環境変数 | 取得元 |
|----------|--------|
| `X_API_KEY` | API Key (Consumer Key) |
| `X_API_SECRET` | API Key Secret (Consumer Secret) |
| `X_ACCESS_TOKEN` | Access Token |
| `X_ACCESS_TOKEN_SECRET` | Access Token Secret |

> **注意**: Access Token / Secret は「Generate」ボタンで発行してください。  
> OAuth 1.0a 署名に **Read and Write** スコープが必要です。

### 2. .env.local に設定

`.env.example` をコピーして `.env.local` を作成し、取得した値を記入します:

```bash
cp .env.example .env.local
```

```env
X_API_KEY="your-api-key"
X_API_SECRET="your-api-secret"
X_ACCESS_TOKEN="your-access-token"
X_ACCESS_TOKEN_SECRET="your-access-token-secret"
ENABLE_REAL_X_POSTING="true"
```

### 3. 投稿モードの切り替え

| `ENABLE_REAL_X_POSTING` | 動作 |
|------------------------|------|
| `"true"` かつ全環境変数が設定済み | **本番投稿モード** — X API v2 で実際に投稿 |
| それ以外（未設定 / `"false"`） | **ダミー投稿モード** — ログ出力のみ、SNS には送信しない |

投稿キュー画面（`/queue`）のヘッダーに現在のモードがバッジで表示されます。

### 4. 動作確認

```bash
# ダミーモードで自動投稿を手動実行
curl -X POST http://localhost:3000/api/queue/auto-post

# 現在の投稿モードを確認
curl http://localhost:3000/api/queue/posting-mode
```

---

## Instagram API 設定（予定）

```env
INSTAGRAM_ACCESS_TOKEN=...
INSTAGRAM_BUSINESS_ACCOUNT_ID=...
```

現在はダミー投稿（ログ出力のみ）です。Instagram Graph API の実装は今後追加予定です。

---

## ディレクトリ構成

```
sns-manager/
├── prisma/
│   └── schema.prisma          データベーススキーマ
├── src/
│   ├── app/
│   │   ├── api/               APIルート (Next.js Route Handlers)
│   │   │   ├── posts/         投稿 CRUD
│   │   │   ├── captions/      キャプション生成
│   │   │   ├── analytics/     分析データ
│   │   │   └── scheduler/     スケジューラー
│   │   ├── analytics/         分析画面
│   │   ├── calendar/          カレンダー画面
│   │   ├── posts/             投稿一覧・作成・編集画面
│   │   └── page.tsx           ダッシュボード
│   ├── components/            共通 UI コンポーネント
│   ├── lib/
│   │   ├── db.ts              Prisma クライアント
│   │   ├── safety.ts          安全チェッカー
│   │   ├── caption-generator.ts キャプション生成
│   │   └── publisher/         投稿処理モジュール
│   └── types/                 TypeScript 型定義
```

---

## 今後の拡張案

### フェーズ2: API 連携
- [ ] X API v2 での実際の投稿
- [ ] Instagram Content Publishing API での投稿
- [ ] メディアファイルの自動アップロード

### フェーズ3: AI キャプション強化
- [ ] Claude API (`claude-opus-4-7`) を使った高品質なキャプション自動生成
- [ ] 過去の高エンゲージメント投稿パターンを学習して提案

### フェーズ4: 自動化強化
- [ ] cron ジョブによる完全自動投稿（確認ステップを任意化）
- [ ] CSV インポートによる分析データ一括登録
- [ ] Webhook 受信による自動エンゲージメント取得（X API Basic以上）

### フェーズ5: 高度分析
- [ ] エンゲージメント率の自動計算
- [ ] 最適投稿時間の推薦
- [ ] A/Bテスト用にキャプション変異を管理

### フェーズ6: 運用効率化
- [ ] 複数キャラクター / アカウントの管理
- [ ] チームコラボレーション（承認ワークフロー）
- [ ] Slack 通知（確認待ち・投稿完了・エラー）

---

## 安全ポリシー

このシステムは以下のコンテンツのみを対象にしています：

✅ **対象コンテンツ**
- 成人に見えるキャラクターのファッション・グラビア風・ライフスタイル系投稿
- 健全な日常・ポートレート表現

❌ **禁止コンテンツ（自動ブロック）**
- 未成年を想起させる表現（JK, JC, 中学生 等）
- 露骨な性的表現・わいせつ表現
- スパムパターン・フォロバ誘導
- プラットフォーム規約違反表現

---

## ライセンス

MIT
