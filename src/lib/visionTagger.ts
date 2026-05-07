/**
 * Vision AI タグ付けモジュール
 *
 * プロバイダー抽象化により OpenAI / Gemini を差し替え可能。
 * 現在の実装: OpenAI GPT-4o Vision
 *
 * 必要な環境変数:
 *   OPENAI_API_KEY — OpenAI API キー
 */

import type { VisionTagResult } from "@/types";

// ─── プロバイダー インターフェース ──────────────────────────────────────────────

export interface VisionProvider {
  analyzeImage(imageBase64: string, mimeType: string): Promise<VisionTagResult>;
}

// ─── プロンプト ────────────────────────────────────────────────────────────────

const ANALYSIS_PROMPT = `あなたはSNS投稿画像の分析専門家です。
与えられた画像を分析し、以下4項目を日本語で簡潔に記述してください。

必ず以下のJSONのみで返答してください（余計な説明・マークダウン不要）:
{
  "growthReasonMemo": "この投稿がバズった・注目された理由の考察（構図・表情・雰囲気・タイミングなど）",
  "compositionNote": "構図・フレーミング・カメラアングル・レイアウト・視線誘導の観察",
  "characterNote": "人物の表情・ポーズ・衣装・キャラクター性・魅力ポイントの観察",
  "backgroundNote": "背景・環境・空間・ロケーション・色調・雰囲気の観察"
}

各項目は50〜150文字程度で具体的に記述してください。
人物が写っていない場合は characterNote に「人物なし」と記入してください。`;

// ─── OpenAI Vision プロバイダー ────────────────────────────────────────────────

class OpenAIVisionProvider implements VisionProvider {
  constructor(private readonly apiKey: string) {}

  async analyzeImage(imageBase64: string, mimeType: string): Promise<VisionTagResult> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: ANALYSIS_PROMPT },
              {
                type: "image_url",
                image_url: {
                  url:    `data:${mimeType};base64,${imageBase64}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
        max_tokens:      800,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI API エラー (${res.status}): ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const content: string | undefined = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI からの応答が空でした");

    let parsed: Partial<VisionTagResult>;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(`JSON 解析に失敗しました: ${content.slice(0, 200)}`);
    }

    return {
      growthReasonMemo: parsed.growthReasonMemo ?? "",
      compositionNote:  parsed.compositionNote  ?? "",
      characterNote:    parsed.characterNote    ?? "",
      backgroundNote:   parsed.backgroundNote   ?? "",
    };
  }
}

// ─── ファクトリー ─────────────────────────────────────────────────────────────

export function createVisionProvider(): VisionProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY が設定されていません");
  // 将来 Gemini に差し替える場合はここを切り替える
  // if (process.env.AI_PROVIDER === "gemini") return new GeminiVisionProvider(...)
  return new OpenAIVisionProvider(apiKey);
}

// ─── 単体解析 ─────────────────────────────────────────────────────────────────

export async function analyzeImage(
  imageBase64: string,
  mimeType:    string
): Promise<VisionTagResult> {
  const provider = createVisionProvider();
  return provider.analyzeImage(imageBase64, mimeType);
}

// ─── バッチ解析 ────────────────────────────────────────────────────────────────

export type BatchImageInput = {
  base64:   string;
  mimeType: string;
};

export type BatchVisionResultItem = {
  index:  number;
  result: VisionTagResult | null;
  error:  string | null;
};

export async function analyzeImages(
  images: BatchImageInput[]
): Promise<BatchVisionResultItem[]> {
  const provider = createVisionProvider();

  return Promise.all(
    images.map(async ({ base64, mimeType }, index) => {
      try {
        const result = await provider.analyzeImage(base64, mimeType);
        return { index, result, error: null };
      } catch (e) {
        return {
          index,
          result: null,
          error:  e instanceof Error ? e.message : "不明なエラー",
        };
      }
    })
  );
}
