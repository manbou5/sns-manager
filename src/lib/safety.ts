import type { SafetyCheckResult, SafetyIssue } from "@/types";

// ─── 禁止ワードリスト ─────────────────────────────────────────────────────────

// ERRORレベル: 未成年を想起させる表現（即時ブロック）
const UNDERAGE_PATTERNS: RegExp[] = [
  /\bjk\b/i,
  /\bjs\b/i,
  /\bjc\b/i,
  /女子(高|中|小)生/,
  /中学生/,
  /高校生/,
  /小学生/,
  /未成年/,
  /ロリ/,
  /loli/i,
  /shota/i,
  /ショタ/,
  /幼女/,
  /幼児/,
  /子ども.*性/,
  /\d{1,2}歳.*([性的]|エロ|グラビア)/,
  /(10|11|12|13|14|15|16|17)歳/,
];

// ERRORレベル: 露骨な性的表現（即時ブロック）
const EXPLICIT_SEXUAL_PATTERNS: RegExp[] = [
  /\bav\b/i,
  /アダルト.*動画/,
  /エロ動画/,
  /ポルノ/,
  /pornograph/i,
  /obscen/i,
  /わいせつ/,
  /猥褻/,
  /局部/,
  /性器/,
  /射精/,
  /オナニー/,
  /masturbat/i,
  /intercourse/i,
  /性交/,
  /レイプ/,
  /rape/i,
];

// WARNINGレベル: スパムパターン
const SPAM_INDICATORS: RegExp[] = [
  /フォロバ/,
  /フォロー\s*バック/,
  /follow\s*back/i,
  /followback/i,
  /相互フォロー/,
  /ff希望/,
  /拡散希望.*\d{3,}/,
];

// WARNINGレベル: プラットフォーム規約違反リスク
const PLATFORM_VIOLATION_PATTERNS: RegExp[] = [
  /購入\s*(→|>|>>|➡)/,
  /DM.*販売/,
  /売り.*DM/,
  /ファン(サ|サイト|クラブ).*リンク.*(bio|プロフ)/,
];

// ─── チェッカー本体 ────────────────────────────────────────────────────────────

export function checkSafety(text: string): SafetyCheckResult {
  const errors: SafetyIssue[] = [];
  const warnings: SafetyIssue[] = [];

  // 未成年チェック
  for (const pattern of UNDERAGE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      errors.push({
        type: "UNDERAGE",
        level: "ERROR",
        message: "未成年を想起させる表現が含まれています。投稿できません。",
        matchedText: match[0],
      });
      break;
    }
  }

  // 露骨な性的表現チェック
  for (const pattern of EXPLICIT_SEXUAL_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      errors.push({
        type: "EXPLICIT_SEXUAL",
        level: "ERROR",
        message: "露骨な性的表現が含まれています。投稿できません。",
        matchedText: match[0],
      });
      break;
    }
  }

  // スパムパターンチェック
  for (const pattern of SPAM_INDICATORS) {
    const match = text.match(pattern);
    if (match) {
      warnings.push({
        type: "SPAM_PATTERN",
        level: "WARNING",
        message: "スパムと見なされる可能性のある表現が含まれています。",
        matchedText: match[0],
      });
      break;
    }
  }

  // プラットフォーム規約違反チェック
  for (const pattern of PLATFORM_VIOLATION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      warnings.push({
        type: "PLATFORM_VIOLATION",
        level: "WARNING",
        message: "プラットフォーム規約に違反する可能性のある表現が含まれています。",
        matchedText: match[0],
      });
      break;
    }
  }

  // ハッシュタグ数チェック（30個超はスパム判定リスク）
  const hashtagCount = (text.match(/#\S+/g) || []).length;
  if (hashtagCount > 30) {
    warnings.push({
      type: "SPAM_PATTERN",
      level: "WARNING",
      message: `ハッシュタグが多すぎます (${hashtagCount}個)。30個以下を推奨します。`,
    });
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

// 投稿間隔チェック: 最終投稿から10分以内の場合はwarning
export function checkPostingFrequency(lastPostedAt: Date | null): SafetyIssue | null {
  if (!lastPostedAt) return null;
  const diffMs = Date.now() - lastPostedAt.getTime();
  const diffMin = diffMs / 1000 / 60;
  if (diffMin < 10) {
    return {
      type: "SPAM_PATTERN",
      level: "WARNING",
      message: `最終投稿から${Math.round(diffMin)}分しか経っていません。短時間の連続投稿はスパム判定のリスクがあります。`,
    };
  }
  return null;
}
