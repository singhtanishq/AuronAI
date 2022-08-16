import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import { marked } from 'marked';

/**
 * Markdown pipeline for assistant messages.
 *
 * - marked renders GFM; the code renderer emits a structured block with a
 *   header, language label, and a copy button carrying the raw code in a
 *   data attribute (delegated listeners handle clicks).
 * - highlight.js highlights each code block exactly once, at render time.
 * - DOMPurify sanitizes the final HTML: model output can never inject
 *   scripts or event handlers, links get rel/target hardening.
 */

const renderer = new marked.Renderer();

renderer.code = (code: string, infostring: string | undefined) => {
  const lang = (infostring || '').split(/\s+/)[0].toLowerCase();
  const label = lang || 'text';

  let highlighted: string;
  try {
    highlighted =
      lang && hljs.getLanguage(lang)
        ? hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
        : hljs.highlightAuto(code).value;
  } catch {
    highlighted = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return (
    `<div class="code-block">` +
    `<div class="code-block-header">` +
    `<span class="code-block-lang">${escapeHtml(label)}</span>` +
    `<button type="button" class="code-block-copy" data-code="${encodeURIComponent(code)}" aria-label="Copy code">Copy</button>` +
    `</div>` +
    `<pre><code class="hljs">${highlighted}</code></pre>` +
    `</div>`
  );
};

// Open external links safely inside sanitized content.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node instanceof Element) {
    const href = node.getAttribute('href') || '';
    if (/^https?:/i.test(href)) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer nofollow');
    } else if (!href.startsWith('#') && !href.startsWith('/')) {
      // javascript:, data:, vbscript: etc. are already stripped by DOMPurify;
      // neutralize anything unusual that remains.
      node.removeAttribute('href');
    }
  }
});

marked.setOptions({
  breaks: true,
  gfm: true,
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderMarkdown(source: string): string {
  const raw = marked.parse(source, { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['style'],
  });
}
