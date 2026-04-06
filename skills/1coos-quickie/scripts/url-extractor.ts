/**
 * URL extraction from user input text
 */

/**
 * Extract the first HTTP/HTTPS URL from input text.
 * Handles CJK text boundaries, trailing punctuation, and balanced parentheses.
 */
export function extractFirstUrl(text: string): string | null {
  // Match http(s) URLs, allowing parentheses (for Wikipedia) and common URL chars
  // Stop at whitespace, CJK characters, and fullwidth/special punctuation
  const urlRegex =
    /https?:\/\/[^\s<>\[\]（）【】「」《》\u3000-\u303F\uFF00-\uFFEF\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\u2E80-\u2EFF\u3000-\u303F\uFE30-\uFE4F]+/i;
  const match = text.match(urlRegex);
  if (!match) return null;

  let url = match[0];

  // Strip trailing punctuation unlikely to be part of the URL
  url = url.replace(/[.,;:!?'"）》」】。，；：！？]+$/, "");

  // Balance parentheses (handles Wikipedia-style URLs)
  while (url.endsWith(")")) {
    const openParens = (url.match(/\(/g) || []).length;
    const closeParens = (url.match(/\)/g) || []).length;
    if (closeParens > openParens) {
      url = url.slice(0, -1);
    } else {
      break;
    }
  }

  return url;
}
