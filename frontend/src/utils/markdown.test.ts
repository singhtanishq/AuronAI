import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown';
import { parseApiDate, formatRelativeTime, formatModelSize, truncateMiddle } from './format';

describe('renderMarkdown', () => {
  it('renders basic markdown', () => {
    const html = renderMarkdown('# Title\n\nSome **bold** text.');
    expect(html).toContain('<h1>');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('strips script tags and event handlers (XSS prevention)', () => {
    const html = renderMarkdown('hello <script>alert(1)</script> <img src=x onerror="alert(1)">');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).toContain('hello');
  });

  it('neutralizes javascript: links', () => {
    const html = renderMarkdown('[click me](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
  });

  it('hardens external links with rel/target', () => {
    const html = renderMarkdown('[site](https://example.com)');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain('target="_blank"');
  });

  it('emits structured code blocks with a copy button carrying the raw code', () => {
    const html = renderMarkdown('```ts\nconst x = 1;\n```');
    expect(html).toContain('code-block');
    expect(html).toContain('code-block-copy');
    expect(html).toContain(`data-code="${encodeURIComponent('const x = 1;')}"`);
    expect(html).toContain('<span class="code-block-lang">ts</span>');
  });

  it('escapes HTML inside code fences so it renders as text', () => {
    const html = renderMarkdown('```\n<script>alert("xss")</script>\n```');
    expect(html).toContain('&lt;script&gt;');
    // The raw tag must not survive inside the highlighted output as a DOM node.
    const container = document.createElement('div');
    document.body.appendChild(container);
    container.innerHTML = html;
    expect(container.querySelectorAll('script')).toHaveLength(0);
    document.body.removeChild(container);
  });

  it('labels unknown languages as text', () => {
    const html = renderMarkdown('```obscurelang\nfoo\n```');
    expect(html).toContain('code-block-lang">text</span>');
  });
});

describe('parseApiDate', () => {
  it('parses ISO strings', () => {
    expect(parseApiDate('2026-10-11T20:00:00.000Z')?.toISOString()).toBe('2026-10-11T20:00:00.000Z');
  });

  it('treats legacy SQLite datetime values as UTC, not local (regression: wrong timestamps)', () => {
    const parsed = parseApiDate('2026-10-11 20:00:00');
    expect(parsed?.toISOString()).toBe('2026-10-11T20:00:00.000Z');
  });

  it('returns null for missing or invalid values', () => {
    expect(parseApiDate(undefined)).toBeNull();
    expect(parseApiDate('')).toBeNull();
    expect(parseApiDate('garbage')).toBeNull();
  });
});

describe('formatRelativeTime', () => {
  it('formats recent moments', () => {
    const now = new Date();
    expect(formatRelativeTime(now.toISOString())).toBe('just now');
  });

  it('formats minutes and hours', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatRelativeTime(fiveMinAgo)).toMatch(/5 minutes? ago/);
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString();
    expect(formatRelativeTime(twoHoursAgo)).toMatch(/2 hours? ago/);
  });

  it('returns empty string for unparsable input', () => {
    expect(formatRelativeTime(undefined)).toBe('');
  });
});

describe('formatModelSize', () => {
  it('formats bytes as storage size, not parameter count', () => {
    expect(formatModelSize(4_700_000_000)).toBe('4.7 GB');
    expect(formatModelSize(800_000_000)).toBe('800 MB');
  });
});

describe('truncateMiddle', () => {
  it('keeps short strings intact', () => {
    expect(truncateMiddle('short', 20)).toBe('short');
  });

  it('truncates the middle with an ellipsis', () => {
    const result = truncateMiddle('a'.repeat(50) + 'MIDDLE' + 'b'.repeat(50), 20);
    expect(result.length).toBeLessThanOrEqual(21);
    expect(result).toContain('…');
  });
});
