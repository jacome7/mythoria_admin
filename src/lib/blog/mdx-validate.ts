const forbiddenPatterns = [
  /(^|\n)\s*import\b/,
  /(^|\n)\s*export\b/,
  /import\s*\(/,
];

export function validateMdxSource(src: string): { ok: true } | { ok: false; reason: string } {
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(src)) {
      return { ok: false, reason: `Forbidden MDX construct matched pattern: ${pattern}` };
    }
  }
  return { ok: true };
}
