export interface TextToken {
  marker?: '#' | '@';
  value: string;
}

function normalizeToken(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLocaleLowerCase('und');
}

/**
 * Deterministic fixture tokenizer for the public TokenSequence call sites used by mute and ads.
 * The upstream xai_post_text implementation is not included in the public checkout.
 */
export function tokenizePostText(text: string): TextToken[] {
  return [...text.matchAll(/([#@]?)([\p{Letter}\p{Number}_]+)/gu)].map((match) => ({
    marker: match[1] === '#' || match[1] === '@' ? match[1] : undefined,
    value: normalizeToken(match[2]),
  }));
}

function tokenMatches(keyword: TextToken, candidate: TextToken): boolean {
  return keyword.value === candidate.value &&
    (!keyword.marker || keyword.marker === candidate.marker);
}

export function containsKeywordSequence(
  candidateTokens: readonly TextToken[],
  keywordTokens: readonly TextToken[]
): boolean {
  if (!keywordTokens.length || keywordTokens.length > candidateTokens.length) return false;
  return candidateTokens.some((_, start) =>
    keywordTokens.every((keyword, offset) => {
      const candidate = candidateTokens[start + offset];
      return candidate !== undefined && tokenMatches(keyword, candidate);
    })
  );
}
