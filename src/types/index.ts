export type PostStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "PENDING_CONFIRMATION"
  | "POSTED"
  | "FAILED";

export type Platform = "X" | "INSTAGRAM" | "BOTH";

export type Genre =
  | "FASHION"
  | "LIFESTYLE"
  | "PORTRAIT"
  | "GRAVURE_STYLE"
  | "OTHER";

export interface Post {
  id: string;
  title?: string | null;
  caption: string;
  mediaPath?: string | null;
  platform: Platform;
  genre: Genre;
  hashtags?: string | null;
  scheduledAt?: string | null;
  postedAt?: string | null;
  status: PostStatus;
  errorMsg?: string | null;
  createdAt: string;
  updatedAt: string;
  analytics?: Analytics | null;
}

export interface Analytics {
  id: string;
  postId: string;
  impressions: number;
  likes: number;
  reposts: number;
  clicks: number;
  followerGain: number;
  recordedAt: string;
  updatedAt: string;
}

export type SafetyLevel = "ERROR" | "WARNING";
export type SafetyIssueType =
  | "UNDERAGE"
  | "EXPLICIT_SEXUAL"
  | "SPAM_PATTERN"
  | "PLATFORM_VIOLATION";

export interface SafetyIssue {
  type: SafetyIssueType;
  level: SafetyLevel;
  message: string;
  matchedText?: string;
}

export interface SafetyCheckResult {
  passed: boolean;
  errors: SafetyIssue[];
  warnings: SafetyIssue[];
}

export interface CaptionSuggestion {
  text: string;
  hashtags: string[];
  style: string;
}

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
}

// ─── 生成コンテンツ管理 ────────────────────────────────────────────────────────

export type ContentStatus = "draft" | "ready" | "scheduled" | "posted";

export interface GeneratedContent {
  id: string;
  title?: string | null;
  prompt?: string | null;
  caption?: string | null;
  hashtags?: string | null;
  mediaType: string;
  mediaUrl?: string | null;
  status: ContentStatus;
  sourceBenchmarkPostId?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── 投稿キュー ────────────────────────────────────────────────────────────────

export type QueueStatus = "queued" | "posted" | "failed" | "cancelled";

export interface PostQueueItem {
  id: string;
  generatedContentId: string;
  platform: string;
  scheduledAt?: string | null;
  status: QueueStatus;
  externalPostId?: string | null;
  errorMessage?: string | null;
  postedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// GET /api/queue で返す、generatedContent を含む形
export interface PostQueueWithContent extends PostQueueItem {
  generatedContent: {
    id: string;
    title?: string | null;
    caption?: string | null;
    hashtags?: string | null;
    mediaType: string;
    mediaUrl?: string | null;
  };
}

// ─── 投稿実績 ─────────────────────────────────────────────────────────────────

export interface PerformanceMetric {
  id: string;
  postQueueId: string;
  platform: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  followersGained: number;
  engagementRate: number;
  measuredAt: string;
  createdAt: string;
}

// GET /api/performance で返す、postQueue + generatedContent を含む形
export interface PerformanceMetricWithQueue extends PerformanceMetric {
  postQueue: {
    id: string;
    platform: string;
    updatedAt: string;
    generatedContent: {
      id: string;
      title?: string | null;
      caption?: string | null;
      mediaType: string;
    };
  };
}

// ─── 再学習ダッシュボード ─────────────────────────────────────────────────────

export interface LearningPlatformStat {
  platform: string;
  count: number;
  avgViews: number;
  avgLikes: number;
  avgEngagementRate: number;
}

export interface LearningMediaTypeStat {
  mediaType: string;
  count: number;
  avgViews: number;
  avgLikes: number;
  avgEngagementRate: number;
}

export interface LearningTopPost {
  metricId: string;
  title?: string | null;
  caption?: string | null;
  prompt?: string | null;
  mediaType: string;
  platform: string;
  views: number;
  likes: number;
  engagementRate: number;
  measuredAt: string;
}

export interface LearningDashboardData {
  totalMetrics: number;
  avgEngagementRate: number;
  avgViews: number;
  avgLikes: number;
  totalFollowersGained: number;
  // ER 上位30% の最低 ER 値（しきい値）
  highErThreshold: number;
  platformStats: LearningPlatformStat[];
  mediaTypeStats: LearningMediaTypeStat[];
  topPosts: LearningTopPost[];
  highErPrompts: string[];
  highErCaptions: string[];
}

// ─── ベンチマーク分析 ──────────────────────────────────────────────────────────

export const GROWTH_REASON_TAGS = [
  "構図",
  "表情",
  "服装",
  "背景",
  "動画テンポ",
  "カメラワーク",
  "キャプション",
  "ハッシュタグ",
  "投稿時間",
  "その他",
] as const;

export type GrowthReasonTag = (typeof GROWTH_REASON_TAGS)[number];

export type MediaType = "IMAGE" | "VIDEO" | "MIXED";

export interface BenchmarkPost {
  id: string;
  accountName: string;
  postUrl?: string | null;
  postedAt?: string | null;
  bodyText?: string | null;
  mediaType: MediaType;
  videoDuration?: string | null;
  compositionNote?: string | null;
  characterNote?: string | null;
  backgroundNote?: string | null;
  aiReductionNote?: string | null;
  likes: number;
  reposts: number;
  replies: number;
  views: number;
  growthReasonNote?: string | null;
  // "|構図|表情|" 形式で保存
  growthReasonTags?: string | null;
  applicationNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BenchmarkImportError {
  row: number;
  accountName: string;
  message: string;
}

// ─── ベンチマーク集計レスポンス ────────────────────────────────────────────────

export interface BenchmarkTagStat {
  tag: string;
  count: number;
  avgViews: number;
  avgLikes: number;
  avgReposts: number;
  avgEngagementRate: number; // (likes + reposts + replies) / views * 100
}

export interface BenchmarkAccountStat {
  accountName: string;
  count: number;
  avgViews: number;
  avgLikes: number;
  avgEngagementRate: number;
}

export interface BenchmarkMediaTypeStat {
  mediaType: MediaType;
  label: string;
  count: number;
  avgViews: number;
  avgLikes: number;
  avgEngagementRate: number;
}

export interface BenchmarkDurationStat {
  videoDuration: string;
  count: number;
  avgViews: number;
  avgLikes: number;
}

export interface BenchmarkAnalyticsData {
  totalPosts: number;
  postsWithViews: number;
  overallAvgViews: number;
  overallAvgLikes: number;
  overallAvgEngagementRate: number;
  tagStats: BenchmarkTagStat[];
  accountStats: BenchmarkAccountStat[];
  mediaTypeStats: BenchmarkMediaTypeStat[];
  durationStats: BenchmarkDurationStat[];
}

// ─── プロンプト最適化 ──────────────────────────────────────────────────────────

export interface PromptOptimizeResult {
  optimizedPrompt: string;
  recommendedTags: string[];
  recommendedMediaType: string;
  reason: string;
  basedOnCount: number;
  highErThreshold: number;
}

// ─── ベンチマーク推薦 ──────────────────────────────────────────────────────────

export interface RecommendedTag {
  tag: string;
  frequency: number;
  avgViews: number;
  vsOverallViews?: number;  // 全体平均再生数との比率 (1.8 = 80%高い)
  top30pctRate?: number;    // 上位30%投稿への出現率 0–1
  reason?: string;          // 推薦理由テキスト
}

// ─── ベンチマーク深層分析 ────────────────────────────────────────────────────────

export interface BenchmarkTagInsight {
  tag: string;
  count: number;
  avgViews: number;
  avgLikes: number;
  avgEngagementRate: number;
  top30pctRate: number;    // 上位30%投稿への出現率 0–1
  vsOverallViews: number;  // 全体平均再生数比率 (1.2 = 20%高い)
  vsOverallER: number;     // 全体平均ER比率
}

export interface BenchmarkTagCombo {
  tagA: string;
  tagB: string;
  count: number;
  avgViews: number;
  avgLikes: number;
  avgEngagementRate: number;
  vsIndividualAvg: number; // 単タグ平均viewsの単純平均との比率
}

export interface BenchmarkInsightsData {
  totalPosts: number;
  overallAvgViews: number;
  overallAvgEngagementRate: number;
  top30pctThreshold: number;
  winnerTags: BenchmarkTagInsight[];
  loserTags: BenchmarkTagInsight[];
  tagCombos: BenchmarkTagCombo[];
  allTagStats: BenchmarkTagInsight[];
}

export interface BenchmarkRecommendationData {
  totalAnalyzed: number;
  highPerfCount: number;
  viewsThreshold: number;
  recommendedTags: RecommendedTag[];
  recommendedMediaType: {
    mediaType: MediaType;
    label: string;
    frequency: number;
    avgViews: number;
  } | null;
  recommendedDuration: {
    videoDuration: string;
    frequency: number;
    avgViews: number;
  } | null;
  // 構図タグ付き高パフォーマンス投稿の compositionNote
  compositionExamples: string[];
  // 表情タグ付き高パフォーマンス投稿の characterNote（専用フィールド代替）
  expressionExamples: string[];
  // 背景タグ付き高パフォーマンス投稿の compositionNote（専用フィールド代替）
  backgroundExamples: string[];
  applicationExamples: string[];
  postTitleSuggestion: string;
  aiPromptSuggestion: string;
  // 不足フィールドに関する通知
  fieldNotices: string[];
}

// ─── AI Vision タグ付け ───────────────────────────────────────────────────────

export interface VisionTagResult {
  growthReasonMemo: string;
  compositionNote:  string;
  characterNote:    string;
  backgroundNote:   string;
}

export interface VisionTagBatchItem {
  index:    number;
  filename: string;
  result:   VisionTagResult | null;
  error:    string | null;
}

// ─── ツイートメトリクス ──────────────────────────────────────────────────────────

export interface TweetMetrics {
  likes:     number | null;
  comments:  number | null;
  shares:    number | null;
  views:     number | null;
  mediaType: MediaType;
}
