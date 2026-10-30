/**
 * Clean text utility for promotional display.
 * Decodes numeric and named HTML entities (such as &#x20;, &#xA0;, &nbsp;),
 * strips stray Markdown syntax (**bold**, __italic__, # headers, `code`),
 * normalizes irregular whitespace, and ensures clean single-line strings.
 */
export const cleanPromoText = (text) => {
  if (!text || typeof text !== 'string') return '';

  let str = text;

  // 1. Explicitly decode common HTML entities (including hex entity codes)
  str = str
    .replace(/&#x20;/gi, ' ')
    .replace(/&#xA0;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/&#32;/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

  // In browser, decode any remaining obscure entities via DOMParser if available
  if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(str, 'text/html');
      str = doc.body.textContent || str;
    } catch {
      // Keep regex-cleaned string
    }
  }

  // 2. Fix corrupted unicode replacement characters (e.g. from encoding mismatches)
  str = str.replace(/\uFFFD/g, '—');

  // 3. Remove stray Markdown formatting symbols
  str = str
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#+\s*/gm, '');

  // 4. Normalize multiple whitespaces and trim
  str = str.replace(/\s+/g, ' ').trim();

  return str;
};
