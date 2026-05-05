import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

// ─── ユーティリティ ─────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function er(views: number, likes: number, comments: number, shares: number, saves: number): number {
  if (views <= 0) return 0;
  return Math.round(((likes + comments + shares + saves) / views) * 10000) / 100;
}

// ─── BenchmarkPost 20件 ──────────────────────────────────────────────────────
// 4段階の人気差を意図的に設定（高/高動画/中/低）

const BENCHMARK_POSTS: Prisma.BenchmarkPostCreateManyInput[] = [
  // ── Tier1: 高パフォーマンス IMAGE (@ai_fashion_pro) 5件 ──
  {
    accountName: "@ai_fashion_pro",
    postUrl: "https://x.com/ai_fashion_pro/status/1001",
    postedAt: daysAgo(60),
    bodyText: "夏の自然光ポートレート。白いワンピースに柔らかいリムライトを当て、少しオーバーに露出補正。",
    mediaType: "IMAGE",
    compositionNote: "三分割法・目線右向き・背景ボケ強め",
    characterNote: "微笑み・目に光を入れる・髪をなびかせる",
    likes: 12400, reposts: 3100, replies: 820, views: 185000,
    growthReasonTags: "|構図|表情|服装|",
    growthReasonNote: "構図と表情の組み合わせが最も反応を引いた投稿",
    applicationNote: "三分割＋自然光は再現性高い。次回も採用する",
    createdAt: daysAgo(62),
  },
  {
    accountName: "@ai_fashion_pro",
    postUrl: "https://x.com/ai_fashion_pro/status/1002",
    postedAt: daysAgo(55),
    bodyText: "ミニマル白背景スタジオポートレート。モノクロフィルター風加工。",
    mediaType: "IMAGE",
    compositionNote: "中央配置・ローアングル・余白多め",
    characterNote: "横顔・目線外し・口元アップ",
    likes: 11200, reposts: 2800, replies: 750, views: 162000,
    growthReasonTags: "|構図|表情|",
    growthReasonNote: "余白の使い方がおしゃれと好評",
    createdAt: daysAgo(57),
  },
  {
    accountName: "@ai_fashion_pro",
    postUrl: "https://x.com/ai_fashion_pro/status/1003",
    postedAt: daysAgo(48),
    bodyText: "秋色グラデーションコーデ。暖色背景に合わせた服装選びでトーンを統一。",
    mediaType: "IMAGE",
    compositionNote: "全身ショット・斜め45°・手を腰に",
    characterNote: "正面向き・自信のある表情",
    likes: 10800, reposts: 2600, replies: 700, views: 155000,
    growthReasonTags: "|構図|服装|背景|",
    growthReasonNote: "色彩統一と服装が好評",
    createdAt: daysAgo(50),
  },
  {
    accountName: "@ai_fashion_pro",
    postUrl: "https://x.com/ai_fashion_pro/status/1004",
    postedAt: daysAgo(40),
    bodyText: "カフェテラスでのナチュラルライフスタイルショット。",
    mediaType: "IMAGE",
    compositionNote: "テーブル越し・俯瞰気味・小道具活用",
    characterNote: "柔らかい笑顔・目線カメラ",
    likes: 9600, reposts: 2200, replies: 620, views: 140000,
    growthReasonTags: "|構図|表情|キャプション|",
    growthReasonNote: "生活感のあるシーンが共感を呼んだ",
    applicationNote: "キャプションに「あなたならどうする？」を入れると反応UP",
    createdAt: daysAgo(42),
  },
  {
    accountName: "@ai_fashion_pro",
    postUrl: "https://x.com/ai_fashion_pro/status/1005",
    postedAt: daysAgo(32),
    bodyText: "花畑バックで春コーデフルショット。彩度高めに仕上げ。",
    mediaType: "IMAGE",
    compositionNote: "花をフレームに使う構図・縦長",
    characterNote: "顔は1/3程度・ポーズは自然体",
    likes: 9200, reposts: 2000, replies: 580, views: 130000,
    growthReasonTags: "|構図|服装|背景|",
    createdAt: daysAgo(34),
  },

  // ── Tier2: 高パフォーマンス VIDEO (@ai_fashion_pro) 5件 ──
  {
    accountName: "@ai_fashion_pro",
    postUrl: "https://x.com/ai_fashion_pro/status/1011",
    postedAt: daysAgo(58),
    bodyText: "ルーティン動画：朝のコーデ決め10秒。BGMとのシンクロが好評。",
    mediaType: "VIDEO",
    videoDuration: "10",
    compositionNote: "ループ編集・ビート合わせカット",
    characterNote: "テンポよく動く・笑顔でフィニッシュ",
    likes: 8800, reposts: 2400, replies: 620, views: 115000,
    growthReasonTags: "|動画テンポ|カメラワーク|構図|",
    growthReasonNote: "BGMとの同期が最大の差別化",
    applicationNote: "10〜15秒でループ感を出すと再生数が上がる",
    createdAt: daysAgo(60),
  },
  {
    accountName: "@ai_fashion_pro",
    postUrl: "https://x.com/ai_fashion_pro/status/1012",
    postedAt: daysAgo(50),
    bodyText: "着替えビフォーアフター。編集でトランジションを入れて視覚的なインパクトを演出。",
    mediaType: "VIDEO",
    videoDuration: "15",
    compositionNote: "トランジションカット・全身/アップ交互",
    characterNote: "驚きの表情→満足の笑顔",
    likes: 7900, reposts: 2100, replies: 540, views: 102000,
    growthReasonTags: "|動画テンポ|表情|カメラワーク|",
    createdAt: daysAgo(52),
  },
  {
    accountName: "@ai_fashion_pro",
    postUrl: "https://x.com/ai_fashion_pro/status/1013",
    postedAt: daysAgo(42),
    bodyText: "スローモーション髪なびき動画。環境光を最大活用。",
    mediaType: "VIDEO",
    videoDuration: "8",
    compositionNote: "スロー＋ズームイン・逆光活用",
    characterNote: "横顔・目を閉じる演技",
    likes: 7200, reposts: 1900, replies: 490, views: 94000,
    growthReasonTags: "|カメラワーク|表情|",
    createdAt: daysAgo(44),
  },
  {
    accountName: "@ai_fashion_pro",
    postUrl: "https://x.com/ai_fashion_pro/status/1014",
    postedAt: daysAgo(35),
    bodyText: "1日3コーデ切り替え動画。タップしたくなるサムネで再生数UP。",
    mediaType: "VIDEO",
    videoDuration: "30",
    compositionNote: "タイトルテロップ入り・早送り演出",
    characterNote: "各コーデで表情を変えてキャラ出す",
    likes: 6800, reposts: 1700, replies: 450, views: 87000,
    growthReasonTags: "|動画テンポ|服装|キャプション|",
    applicationNote: "タイトルテロップをサムネに大きく出すと離脱率下がる",
    createdAt: daysAgo(37),
  },
  {
    accountName: "@ai_fashion_pro",
    postUrl: "https://x.com/ai_fashion_pro/status/1015",
    postedAt: daysAgo(28),
    bodyText: "夜の街撮りシネマルック動画。カラーグレーディング強め。",
    mediaType: "VIDEO",
    videoDuration: "20",
    compositionNote: "シネスコ比率・ネオン活用・手持ちブレ演出",
    characterNote: "クールな表情・視線を外す",
    likes: 6400, reposts: 1600, replies: 410, views: 80000,
    growthReasonTags: "|カメラワーク|背景|動画テンポ|",
    createdAt: daysAgo(30),
  },

  // ── Tier3: 中パフォーマンス IMAGE/MIXED (@digital_muse) 5件 ──
  {
    accountName: "@digital_muse",
    postUrl: "https://x.com/digital_muse/status/2001",
    postedAt: daysAgo(45),
    bodyText: "カフェ作業風景。ノートPCとコーヒーを小道具に。",
    mediaType: "IMAGE",
    compositionNote: "俯瞰・モノを並べる構図",
    likes: 1900, reposts: 420, replies: 160, views: 35000,
    growthReasonTags: "|服装|背景|キャプション|",
    createdAt: daysAgo(47),
  },
  {
    accountName: "@digital_muse",
    postUrl: "https://x.com/digital_muse/status/2002",
    postedAt: daysAgo(38),
    bodyText: "雨の日コーデ。透け感ある傘を小道具に使用。",
    mediaType: "IMAGE",
    compositionNote: "雨背景ボケ・縦位置",
    likes: 1700, reposts: 380, replies: 140, views: 31000,
    growthReasonTags: "|服装|背景|",
    createdAt: daysAgo(40),
  },
  {
    accountName: "@digital_muse",
    postUrl: "https://x.com/digital_muse/status/2003",
    postedAt: daysAgo(30),
    bodyText: "ショッピング後のコーデ紹介＋購入品紹介の複合投稿。",
    mediaType: "MIXED",
    compositionNote: "スライド形式・1枚目がフック",
    likes: 1600, reposts: 350, replies: 130, views: 28000,
    growthReasonTags: "|服装|キャプション|ハッシュタグ|",
    applicationNote: "スライド1枚目のフックを強くすると保存率UP",
    createdAt: daysAgo(32),
  },
  {
    accountName: "@digital_muse",
    postUrl: "https://x.com/digital_muse/status/2004",
    postedAt: daysAgo(22),
    bodyText: "グリーン背景でナチュラルコーデ。明るめトーンで統一。",
    mediaType: "IMAGE",
    compositionNote: "腰から上・植物を背景に",
    likes: 1400, reposts: 300, replies: 110, views: 24000,
    growthReasonTags: "|服装|背景|",
    createdAt: daysAgo(24),
  },
  {
    accountName: "@digital_muse",
    postUrl: "https://x.com/digital_muse/status/2005",
    postedAt: daysAgo(15),
    bodyText: "モノトーンコーデ2パターン比較投稿。",
    mediaType: "MIXED",
    compositionNote: "左右比較レイアウト",
    likes: 1300, reposts: 280, replies: 100, views: 21000,
    growthReasonTags: "|服装|構図|",
    createdAt: daysAgo(17),
  },

  // ── Tier4: 低パフォーマンス IMAGE (@casual_snap) 5件 ──
  {
    accountName: "@casual_snap",
    postUrl: "https://x.com/casual_snap/status/3001",
    postedAt: daysAgo(50),
    bodyText: "普通の日常コーデ。特にテーマなし。",
    mediaType: "IMAGE",
    likes: 180, reposts: 35, replies: 28, views: 7200,
    growthReasonTags: "|その他|",
    createdAt: daysAgo(52),
  },
  {
    accountName: "@casual_snap",
    postUrl: "https://x.com/casual_snap/status/3002",
    postedAt: daysAgo(43),
    bodyText: "コンビニ前でサクッと撮影。",
    mediaType: "IMAGE",
    likes: 150, reposts: 28, replies: 22, views: 6100,
    growthReasonTags: "|その他|",
    createdAt: daysAgo(45),
  },
  {
    accountName: "@casual_snap",
    postUrl: "https://x.com/casual_snap/status/3003",
    postedAt: daysAgo(36),
    bodyText: "室内自撮り。照明が暗かった。",
    mediaType: "IMAGE",
    likes: 120, reposts: 22, replies: 18, views: 5000,
    growthReasonTags: "|その他|",
    createdAt: daysAgo(38),
  },
  {
    accountName: "@casual_snap",
    postUrl: "https://x.com/casual_snap/status/3004",
    postedAt: daysAgo(28),
    bodyText: "試しに撮ってみた。構図特になし。",
    mediaType: "IMAGE",
    likes: 100, reposts: 18, replies: 15, views: 4200,
    growthReasonTags: "|その他|",
    createdAt: daysAgo(30),
  },
  {
    accountName: "@casual_snap",
    postUrl: "https://x.com/casual_snap/status/3005",
    postedAt: daysAgo(20),
    bodyText: "急いで撮ったので雑。",
    mediaType: "IMAGE",
    likes: 85, reposts: 15, replies: 12, views: 3500,
    growthReasonTags: "|その他|",
    createdAt: daysAgo(22),
  },
];

// ─── GeneratedContent + PostQueue + PerformanceMetric ────────────────────────
// 5件：ER差を明確にして分析ダッシュボードで差が出るよう設計

type ContentSeed = Prisma.GeneratedContentCreateInput;

function buildContents(): ContentSeed[] {
  return [
    // ── 1: ER 9.0% ──────────────────────────────────────────────────────────
    {
      title: "【高ER】自然光ポートレート 夏",
      prompt: `# AIキャラクター投稿 生成プロンプト

## キャラクター・表情
- 柔らかい微笑み、目に自然なハイライト
- 視線はカメラに向ける
- 髪は軽く風でなびく演出

## 構図・背景
- 三分割法、被写体を右1/3に配置
- 背景は夏の日差し、強いボケ（f1.8相当）
- 上半身ショット

## 色調・仕上げ
- 自然光ベース、暖色系にシフト
- スキントーンを少しオーバー気味に`,
      caption: "夏の光の中で🌿 自然体の一枚です。\nどんな場所で撮りたい？コメントで教えてください☀️",
      hashtags: "#AIポートレート #夏コーデ #naturallight #fashion #AIモデル",
      mediaType: "IMAGE",
      status: "posted",
      postQueues: {
        create: [{
          platform: "X",
          status: "posted",
          scheduledAt: daysAgo(21),
          performanceMetrics: {
            create: [{
              platform: "X",
              views: 50000,
              likes: 3000,
              comments: 200,
              shares: 500,
              saves: 800,
              followersGained: 45,
              engagementRate: er(50000, 3000, 200, 500, 800),
              measuredAt: daysAgo(14),
            }],
          },
        }],
      },
    },

    // ── 2: ER 8.5% ──────────────────────────────────────────────────────────
    {
      title: "【高ER】秋コーデ全身ショット",
      prompt: `# 秋コーデ全身ショット

## キャラクター・表情
- 自信のある表情、正面向き
- 全身が入るように立ちポーズ

## 構図・背景
- 縦位置全身・足元まで入れる
- 背景は秋の街並み（落ち葉・暖色）

## スタイリング
- 暖色系コーデ（テラコッタ・ブラウン系）
- アクセサリーで仕上げ感を出す`,
      caption: "秋色コーデ🍂 暖かみのある色を集めてみました。\nどのアイテムが気になりますか？",
      hashtags: "#秋コーデ #AIファッション #autumnlook #コーデ #ootd",
      mediaType: "IMAGE",
      status: "posted",
      postQueues: {
        create: [{
          platform: "INSTAGRAM",
          status: "posted",
          scheduledAt: daysAgo(18),
          performanceMetrics: {
            create: [{
              platform: "INSTAGRAM",
              views: 40000,
              likes: 2200,
              comments: 180,
              shares: 380,
              saves: 640,
              followersGained: 38,
              engagementRate: er(40000, 2200, 180, 380, 640),
              measuredAt: daysAgo(11),
            }],
          },
        }],
      },
    },

    // ── 3: ER 5.2% ──────────────────────────────────────────────────────────
    {
      title: "【中ER】カフェライフスタイル",
      prompt: `# カフェライフスタイル投稿

## シーン設定
- カフェのテーブルに座ったシーン
- ラテアートのカップを持つ

## 構図
- テーブルを挟んで正面
- 俯瞰気味

## 雰囲気
- ナチュラル系・明るいトーン`,
      caption: "週末はゆっくりカフェタイム☕\nお気に入りのカフェはありますか？",
      hashtags: "#カフェ #ライフスタイル #AIキャラ #cafe #weekend",
      mediaType: "IMAGE",
      status: "posted",
      postQueues: {
        create: [{
          platform: "X",
          status: "posted",
          scheduledAt: daysAgo(14),
          performanceMetrics: {
            create: [{
              platform: "X",
              views: 25000,
              likes: 900,
              comments: 80,
              shares: 200,
              saves: 120,
              followersGained: 12,
              engagementRate: er(25000, 900, 80, 200, 120),
              measuredAt: daysAgo(7),
            }],
          },
        }],
      },
    },

    // ── 4: ER 3.0% ──────────────────────────────────────────────────────────
    {
      title: "【低ER】背景グリーンコーデ",
      prompt: `# グリーン背景コーデ

## 構図
- 腰から上
- 植物を背景に配置

## 色調
- 明るめナチュラル`,
      caption: "グリーンに癒される一枚🌿",
      hashtags: "#グリーン #ナチュラル #AIモデル",
      mediaType: "IMAGE",
      status: "posted",
      postQueues: {
        create: [{
          platform: "INSTAGRAM",
          status: "posted",
          scheduledAt: daysAgo(10),
          performanceMetrics: {
            create: [{
              platform: "INSTAGRAM",
              views: 20000,
              likes: 400,
              comments: 40,
              shares: 100,
              saves: 60,
              followersGained: 5,
              engagementRate: er(20000, 400, 40, 100, 60),
              measuredAt: daysAgo(3),
            }],
          },
        }],
      },
    },

    // ── 5: ER 1.6% ──────────────────────────────────────────────────────────
    {
      title: "【低ER】試験的ミックス投稿",
      prompt: `# 試験的投稿（ER低め）

## メモ
- 実験的な構図のためERは低め
- 今後の参考データとして保持`,
      caption: "新しいスタイルを試してみました。どう思いますか？",
      hashtags: "#新スタイル #実験",
      mediaType: "MIXED",
      status: "posted",
      postQueues: {
        create: [{
          platform: "X",
          status: "posted",
          scheduledAt: daysAgo(7),
          performanceMetrics: {
            create: [{
              platform: "X",
              views: 10000,
              likes: 100,
              comments: 10,
              shares: 20,
              saves: 30,
              followersGained: 2,
              engagementRate: er(10000, 100, 10, 20, 30),
              measuredAt: daysAgo(1),
            }],
          },
        }],
      },
    },
  ];
}

// ─── エクスポート関数 ─────────────────────────────────────────────────────────

export async function getDataCounts() {
  const [benchmarkPost, generatedContent, postQueue, performanceMetric, post] =
    await Promise.all([
      prisma.benchmarkPost.count(),
      prisma.generatedContent.count(),
      prisma.postQueue.count(),
      prisma.performanceMetric.count(),
      prisma.post.count(),
    ]);
  return { benchmarkPost, generatedContent, postQueue, performanceMetric, post };
}

export async function seedDevData() {
  const counts = await getDataCounts();
  const total =
    counts.benchmarkPost +
    counts.generatedContent +
    counts.postQueue +
    counts.performanceMetric;

  if (total > 0) {
    return {
      ok: false as const,
      message:
        "既存データがあります。「全データ削除」を実行してから再投入してください。",
      counts,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.benchmarkPost.createMany({ data: BENCHMARK_POSTS });
    for (const data of buildContents()) {
      await tx.generatedContent.create({ data });
    }
  });

  const after = await getDataCounts();
  return {
    ok: true as const,
    message: `サンプルデータを投入しました（BenchmarkPost: ${after.benchmarkPost}件、GeneratedContent: ${after.generatedContent}件、PostQueue: ${after.postQueue}件、PerformanceMetric: ${after.performanceMetric}件）`,
    counts: after,
  };
}

export async function clearDevData() {
  await prisma.$transaction([
    prisma.performanceMetric.deleteMany(),
    prisma.postQueue.deleteMany(),
    prisma.generatedContent.deleteMany(),
    prisma.benchmarkPost.deleteMany(),
    prisma.analytics.deleteMany(),
    prisma.post.deleteMany(),
  ]);

  return { ok: true as const, message: "全データを削除しました" };
}
