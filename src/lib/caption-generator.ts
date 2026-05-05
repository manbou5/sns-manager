import type { CaptionSuggestion, Genre } from "@/types";

// ─── テンプレートベースのキャプション生成 ────────────────────────────────────
// ANTHROPIC_API_KEYが設定されていれば後でClaude APIに切り替え可能

type Template = {
  text: string;
  hashtags: string[];
  style: string;
};

const TEMPLATES: Record<Genre, Template[]> = {
  FASHION: [
    {
      text: "今日のコーデ🌸\nシンプルだけど、ちょっとだけ特別な一日。",
      hashtags: ["#AIファッション", "#コーデ", "#ootd", "#fashion", "#AIイラスト"],
      style: "カジュアル・親近感",
    },
    {
      text: "着こなしで気分も変わる✨\nあなたはどんな一日でしたか？",
      hashtags: ["#スタイル", "#fashion", "#AIキャラ", "#コーディネート"],
      style: "問いかけ・エンゲージメント促進",
    },
    {
      text: "季節を感じる装い🍃\n色合いにこだわった一枚です。",
      hashtags: ["#seasonalstyle", "#AIイラスト", "#fashion", "#ファッション"],
      style: "季節感・美学",
    },
  ],
  LIFESTYLE: [
    {
      text: "穏やかな朝の始まり☀️\nコーヒーの香りとともに。",
      hashtags: ["#モーニングルーティン", "#AIライフスタイル", "#朝活", "#lifestyle"],
      style: "日常・共感",
    },
    {
      text: "今日も一日、丁寧に過ごしたい🌿\nあなたの今日はどんな一日ですか？",
      hashtags: ["#丁寧な暮らし", "#lifestyle", "#AIイラスト", "#日常"],
      style: "問いかけ・共感",
    },
    {
      text: "休日の贅沢な時間💆‍♀️\n何もしない、が一番のリフレッシュ。",
      hashtags: ["#休日", "#リラックス", "#AIキャラ", "#休日の過ごし方"],
      style: "リラックス・共感",
    },
  ],
  PORTRAIT: [
    {
      text: "視線の先には、何が見えていると思いますか？👁️",
      hashtags: ["#ポートレート", "#AIイラスト", "#portrait", "#AI美女"],
      style: "ミステリアス・問いかけ",
    },
    {
      text: "表情に込めた想いは、言葉より正直。",
      hashtags: ["#portrait", "#AIアート", "#AI美女", "#イラスト"],
      style: "詩的・哲学的",
    },
    {
      text: "一瞬を切り取った、この表情が好き📸",
      hashtags: ["#AIポートレート", "#illustration", "#AIキャラクター"],
      style: "瞬間・美学",
    },
  ],
  GRAVURE_STYLE: [
    {
      text: "夏の光の中で🌞\n風が気持ちよかった一日。",
      hashtags: ["#グラビア風", "#AIイラスト", "#夏", "#AI美女", "#summer"],
      style: "季節感・爽やか",
    },
    {
      text: "自然光が一番好き✨\nこの瞬間、空気まで感じてほしい。",
      hashtags: ["#グラビア風", "#AIグラビア", "#AIイラスト", "#naturallight"],
      style: "自然・美学",
    },
    {
      text: "ちょっとだけ大人っぽく、今日はこんな感じで🌹",
      hashtags: ["#AI美女", "#グラビア風", "#AIキャラ", "#美女"],
      style: "大人・エレガント",
    },
  ],
  OTHER: [
    {
      text: "今日もよろしくお願いします🌸",
      hashtags: ["#AIイラスト", "#AIキャラクター", "#illustration"],
      style: "汎用・挨拶",
    },
    {
      text: "新しい一枚をお届け✨\nどんな気持ちになりましたか？",
      hashtags: ["#AIアート", "#AIイラスト", "#AIキャラ"],
      style: "汎用・問いかけ",
    },
    {
      text: "また会えましたね😊\nいつもありがとうございます。",
      hashtags: ["#AIキャラクター", "#daily", "#AIイラスト"],
      style: "感謝・親近感",
    },
  ],
};

// プラットフォーム別のハッシュタグ付与ルール
const PLATFORM_HASHTAGS: Record<string, string[]> = {
  X: ["#AI生成", "#Midjourney", "#StableDiffusion"],
  INSTAGRAM: ["#ai_art", "#aiartwork", "#digitalart", "#aicharacter"],
  BOTH: ["#AI生成", "#aiartwork"],
};

export function generateCaptions(
  genre: Genre,
  platform: string,
  count = 3
): CaptionSuggestion[] {
  const templates = TEMPLATES[genre] ?? TEMPLATES.OTHER;
  const platformTags = PLATFORM_HASHTAGS[platform] ?? [];

  return templates.slice(0, count).map((t) => ({
    text: t.text,
    hashtags: [...t.hashtags, ...platformTags],
    style: t.style,
  }));
}

// TODO: Claude APIを使う高品質生成（ANTHROPIC_API_KEY設定後に有効化）
// export async function generateCaptionsWithAI(
//   genre: Genre,
//   platform: string,
//   context: string
// ): Promise<CaptionSuggestion[]> {
//   const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
//   const message = await anthropic.messages.create({
//     model: "claude-opus-4-7",
//     max_tokens: 1024,
//     messages: [{ role: "user", content: `...` }],
//   });
//   ...
// }
