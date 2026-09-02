import sanitizeHtml from "sanitize-html";

const RICH_EMAIL_TAGS = [
  "p",
  "div",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "a",
  "blockquote",
] as const;

const richTagPattern = new RegExp(`<\\/?(?:${RICH_EMAIL_TAGS.join("|")})(?:\\s|>|\\/)`, "i");

export function isRichEmailHtml(value: string) {
  return richTagPattern.test(value);
}

export function sanitizeInternalEmailHtml(value: string) {
  return sanitizeHtml(value, {
    allowedTags: [...RICH_EMAIL_TAGS],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      a: (_tagName, attributes) => ({
        tagName: "a",
        attribs: {
          ...attributes,
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    },
  }).trim();
}

function decodeTextEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:0*39|x0*27);/gi, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

export function internalEmailPlainText(value: string) {
  if (!isRichEmailHtml(value)) return decodeTextEntities(value).trim();
  const withLineBreaks = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|blockquote|li)>/gi, "\n");
  return decodeTextEntities(sanitizeHtml(withLineBreaks, { allowedTags: [], allowedAttributes: {} }))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function hasInternalEmailContent(value: string) {
  return internalEmailPlainText(value).length > 0;
}

