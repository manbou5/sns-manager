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

## API 連携の追加方法

### X (Twitter) API

1. `.env.local` に以下を追加:
   ```
   X_API_KEY=...
   X_API_SECRET=...
   X_ACCESS_TOKEN=...
   X_ACCESS_TOKEN_SECRET=...
   ```
2. `npm install twitter-api-v2` を実行
3. `src/lib/publisher/twitter.ts` の TODO コメント箇所を実装

### Instagram API

1. `.env.local` に以下を追加:
   ```
   INSTAGRAM_ACCESS_TOKEN=...
   INSTAGRAM_BUSINESS_ACCOUNT_ID=...
   ```
2. `src/lib/publisher/instagram.ts` の TODO コメント箇所を実装

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
