export type ContentSafetyCategory =
  | "sexual"
  | "sexual_minors"
  | "sexual_violence";

export interface LocalContentSafetyDecision {
  allowed: boolean;
  categories: ContentSafetyCategory[];
  reason: string;
}

const SAFE_NEGATIONS = [
  /\bno\s+(?:nudity|nudes?|porn(?:ography)?|sexual\s+content)\b/giu,
  /\b(?:not\s+nude|fully\s+clothed|non[-\s]?sexual)\b/giu,
  /(?:不要|禁止|拒绝|避免|无|不含|非)(?:色情|裸体|裸露|性内容|成人视频)/gu,
];

const EXPLICIT_SEXUAL_PATTERNS = [
  /\bporn(?:ography|ographic)?\b/iu,
  /\bxxx\b/iu,
  /\b(?:explicit|hardcore)\s+sex\b/iu,
  /\b(?:oral|anal)\s+sex\b/iu,
  /\bsexual\s+intercourse\b/iu,
  /\b(?:masturbat\w*|handjob|blowjob|cumshot|gangbang)\b/iu,
  /\b(?:fully\s+)?nude\b/iu,
  /\bnaked\s+(?:breasts?|genitals?|body|person|woman|man)\b/iu,
  /\b(?:penis|vagina|genitals?)\b/iu,
  /\b(?:striptease|erotic\s+nude|hentai|rule\s*34)\b/iu,
  /(?:色情|成人视频|成人影片|黄色视频|全裸|裸体|性交|口交|肛交|自慰|手淫|生殖器|阴茎|阴道|脱衣舞|无码色情|色情动漫|里番)/u,
];

const SEXUAL_VIOLENCE_PATTERNS = [
  /\b(?:rape|raping|sexual\s+assault|forced\s+sex)\b/iu,
  /(?:强奸|轮奸|性侵|强迫性交)/u,
];

const MINOR_PATTERNS = [
  /\b(?:child|kid|minor|underage|teen(?:ager)?|schoolgirl|schoolboy|loli|shota)\b/iu,
  /(?:儿童|小孩|未成年|幼女|幼男|学生妹|正太|萝莉)/u,
];

const SEXUAL_CONTEXT_PATTERNS = [
  ...EXPLICIT_SEXUAL_PATTERNS,
  /\b(?:sexy|erotic|fetish|lingerie|topless)\b/iu,
  /(?:性感|情色|性行为|裸照|裸露|情趣)/u,
];

function normalizeForModeration(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[013457]/g, (character) =>
      ({ "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t" })[
        character
      ] ?? character
    );
}

function removeSafeNegations(value: string) {
  return SAFE_NEGATIONS.reduce(
    (current, pattern) => current.replace(pattern, " "),
    value
  );
}

function matchesAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

/**
 * Conservative, high-confidence first-pass screening. It is intentionally not
 * treated as a complete classifier; provider-native and optional external
 * moderation still run around it.
 */
export function assessLocalContentSafety(prompt: string): LocalContentSafetyDecision {
  const normalized = removeSafeNegations(normalizeForModeration(prompt));
  const categories = new Set<ContentSafetyCategory>();

  if (matchesAny(normalized, SEXUAL_VIOLENCE_PATTERNS)) {
    categories.add("sexual_violence");
  }
  if (matchesAny(normalized, EXPLICIT_SEXUAL_PATTERNS)) {
    categories.add("sexual");
  }
  if (
    matchesAny(normalized, MINOR_PATTERNS) &&
    matchesAny(normalized, SEXUAL_CONTEXT_PATTERNS)
  ) {
    categories.add("sexual_minors");
  }

  const blocked = categories.size > 0;
  return {
    allowed: !blocked,
    categories: [...categories],
    reason: blocked
      ? "The request contains sexual or exploitative content prohibited by the content policy."
      : "No high-confidence prohibited sexual content was detected by the local policy.",
  };
}

const UNSAFE_LABELS = new Set([
  "adult",
  "explicit",
  "nsfw",
  "porn",
  "pornographic",
  "sexual",
  "unsafe",
  "violation",
  "blocked",
]);
const SAFE_LABELS = new Set(["allow", "allowed", "pass", "passed", "safe", "sfw"]);
const UNSAFE_BOOLEAN_KEYS = new Set([
  "adult",
  "explicit",
  "flagged",
  "is_flagged",
  "is_nsfw",
  "is_unsafe",
  "nsfw",
  "pornographic",
  "sexual",
  "unsafe",
]);

export interface ExternalModerationDecision {
  allowed: boolean;
  categories: string[];
  reason: string;
}

/** Parse structured moderator responses without persisting the vendor payload. */
export function parseExternalModerationDecision(
  value: unknown
): ExternalModerationDecision | null {
  const categories = new Set<string>();
  let explicitSafe = false;
  let explicitUnsafe = false;

  const visit = (current: unknown, key = "", depth = 0) => {
    if (depth > 8 || current === null || current === undefined) return;
    const normalizedKey = key.toLowerCase();

    if (typeof current === "boolean") {
      if (UNSAFE_BOOLEAN_KEYS.has(normalizedKey) && current) {
        explicitUnsafe = true;
        categories.add(normalizedKey);
      }
      if (normalizedKey === "safe") {
        if (current) explicitSafe = true;
        else explicitUnsafe = true;
      }
      return;
    }

    if (typeof current === "number") {
      if (UNSAFE_BOOLEAN_KEYS.has(normalizedKey) && current >= 0.5) {
        explicitUnsafe = true;
        categories.add(normalizedKey);
      }
      return;
    }

    if (typeof current === "string") {
      const normalized = current.trim().toLowerCase();
      if (UNSAFE_LABELS.has(normalized)) {
        explicitUnsafe = true;
        categories.add(normalized);
      }
      if (SAFE_LABELS.has(normalized)) explicitSafe = true;
      if ((normalized.startsWith("{") || normalized.startsWith("[")) && depth < 8) {
        try {
          visit(JSON.parse(normalized), key, depth + 1);
        } catch {
          // An opaque text output is not enough to make an enforcement decision.
        }
      }
      return;
    }

    if (Array.isArray(current)) {
      current.forEach((item) => visit(item, key, depth + 1));
      return;
    }

    if (typeof current === "object") {
      Object.entries(current as Record<string, unknown>).forEach(([childKey, child]) =>
        visit(child, childKey, depth + 1)
      );
    }
  };

  visit(value);
  if (explicitUnsafe) {
    return {
      allowed: false,
      categories: [...categories],
      reason: "The external content moderator flagged prohibited content.",
    };
  }
  if (explicitSafe) {
    return {
      allowed: true,
      categories: [],
      reason: "The external content moderator approved the content.",
    };
  }
  return null;
}
