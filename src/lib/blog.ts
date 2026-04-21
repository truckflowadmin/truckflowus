/**
 * Markdown blog engine — reads .md files from /content/blog/
 *
 * Each post has YAML-like frontmatter:
 *   ---
 *   title: My Post Title
 *   description: SEO description
 *   date: 2026-04-20
 *   tags: dispatch, trucking
 *   ---
 *   Markdown content here...
 */
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// HTML Sanitizer — allowlist-based, strips all tags/attributes not explicitly
// permitted.  Used to prevent XSS in blog markdown rendering.
// ---------------------------------------------------------------------------
const ALLOWED_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'strong', 'em', 'b', 'i', 'u', 'code', 'pre',
  'a', 'blockquote',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img',
]);

/** Attributes allowed per tag (all others are stripped) */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'rel', 'target']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
  code: new Set(['class']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan']),
};

/** Protocols allowed in href/src attributes */
const SAFE_URL_RE = /^(?:https?:\/\/|mailto:|\/[^/])/i;

function sanitizeHtml(html: string): string {
  // Strip <script>, <style>, <iframe>, <object>, <embed>, <form> and their contents
  let out = html.replace(/<(script|style|iframe|object|embed|form)\b[\s\S]*?<\/\1\s*>/gi, '');

  // Strip HTML comments
  out = out.replace(/<!--[\s\S]*?-->/g, '');

  // Process remaining tags
  out = out.replace(/<\/?([a-z][a-z0-9]*)\b([^>]*)?\/?>/gi, (match, tag: string, attrs: string) => {
    const lower = tag.toLowerCase();
    const isClosing = match.startsWith('</');

    if (!ALLOWED_TAGS.has(lower)) return ''; // strip unknown tags entirely

    if (isClosing) return `</${lower}>`;

    // Filter attributes
    const allowedSet = ALLOWED_ATTRS[lower];
    if (!attrs || !allowedSet) return `<${lower}>`;

    const cleanAttrs: string[] = [];
    const attrRe = /([a-z][a-z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))/gi;
    let m;
    while ((m = attrRe.exec(attrs)) !== null) {
      const name = m[1].toLowerCase();
      const value = m[2] ?? m[3] ?? m[4] ?? '';
      if (!allowedSet.has(name)) continue;
      // Block javascript: and data: URIs in href/src
      if ((name === 'href' || name === 'src') && !SAFE_URL_RE.test(value)) continue;
      cleanAttrs.push(`${name}="${value.replace(/"/g, '&quot;')}"`);
    }

    // Block on* event handlers (belt-and-suspenders — they're not in allowedSet anyway)
    const isSelfClosing = lower === 'img' || lower === 'br' || lower === 'hr';
    const attrStr = cleanAttrs.length ? ' ' + cleanAttrs.join(' ') : '';
    return isSelfClosing ? `<${lower}${attrStr} />` : `<${lower}${attrStr}>`;
  });

  return out;
}

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');
const BLOG_DIR_ES = path.join(process.cwd(), 'content', 'blog', 'es');

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  content: string; // raw markdown
  html: string;    // converted HTML
}

/** Parse simple YAML frontmatter from a markdown string */
function parseFrontmatter(raw: string): { data: Record<string, string>; content: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };
  const data: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      data[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return { data, content: match[2] };
}

/** Convert markdown to HTML (lightweight — handles common patterns) */
function markdownToHtml(md: string): string {
  let html = md
    // Code blocks (```...```)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    // Headings
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Unordered lists
    .replace(/^[*-] (.+)$/gm, '<li>$1</li>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr />')
    // Line breaks → paragraphs
    .replace(/\n\n+/g, '\n\n');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Wrap remaining text blocks in <p>
  const lines = html.split('\n\n');
  html = lines
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (
        trimmed.startsWith('<h') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<ol') ||
        trimmed.startsWith('<pre') ||
        trimmed.startsWith('<hr') ||
        trimmed.startsWith('<blockquote')
      ) {
        return trimmed;
      }
      return `<p>${trimmed}</p>`;
    })
    .join('\n');

  return html;
}

/** Get all blog posts sorted by date (newest first) */
export function getAllPosts(lang: 'en' | 'es' = 'en'): BlogPost[] {
  const dir = lang === 'es' ? BLOG_DIR_ES : BLOG_DIR;
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));

  const posts = files.map((filename) => {
    const slug = filename.replace(/\.md$/, '');
    const raw = fs.readFileSync(path.join(dir, filename), 'utf-8');
    const { data, content } = parseFrontmatter(raw);

    return {
      slug,
      title: data.title || slug,
      description: data.description || '',
      date: data.date || '',
      tags: data.tags ? data.tags.split(',').map((t: string) => t.trim()) : [],
      content,
      html: sanitizeHtml(markdownToHtml(content)),
    };
  });

  return posts.sort((a, b) => (b.date > a.date ? 1 : -1));
}

/** Validate slug format — alphanumeric + hyphens only */
const VALID_SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

/** Get a single post by slug */
export function getPostBySlug(slug: string, lang: 'en' | 'es' = 'en'): BlogPost | null {
  // Reject invalid slug formats to prevent path traversal
  if (!VALID_SLUG_RE.test(slug)) return null;

  const dir = lang === 'es' ? BLOG_DIR_ES : BLOG_DIR;
  const filepath = path.join(dir, `${slug}.md`);
  if (!fs.existsSync(filepath)) return null;

  const raw = fs.readFileSync(filepath, 'utf-8');
  const { data, content } = parseFrontmatter(raw);

  return {
    slug,
    title: data.title || slug,
    description: data.description || '',
    date: data.date || '',
    tags: data.tags ? data.tags.split(',').map((t: string) => t.trim()) : [],
    content,
    html: sanitizeHtml(markdownToHtml(content)),
  };
}
