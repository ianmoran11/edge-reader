import DOMPurify from 'dompurify';

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'span',
      'div',
      'em',
      'strong',
      'i',
      'b',
      'u',
      'a',
      'img',
      'blockquote',
      'ul',
      'ol',
      'li',
      'table',
      'tr',
      'td',
      'th',
      'thead',
      'tbody',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id'],
    ALLOW_DATA_ATTR: false,
  });
}
