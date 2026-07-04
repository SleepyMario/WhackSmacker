const skippedContentTags = new Set(["head", "script", "style", "template", "noscript"]);
const blockTags = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "body",
  "div",
  "dl",
  "dt",
  "dd",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul"
]);

const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

export function renderAnkiCardHtml(html: string): string {
  const renderer = new TerminalHtmlRenderer(html);
  return renderer.render();
}

class TerminalHtmlRenderer {
  private index = 0;
  private output = "";
  private readonly skippedTagStack: string[] = [];

  constructor(private readonly html: string) {}

  render(): string {
    while (this.index < this.html.length) {
      if (this.startsWith("<!--")) {
        this.skipComment();
      } else if (this.html[this.index] === "<") {
        this.consumeTag();
      } else {
        this.consumeText();
      }
    }

    return normalizeTerminalText(stripCssNoise(this.output));
  }

  private consumeText(): void {
    const nextTag = this.html.indexOf("<", this.index);
    const end = nextTag === -1 ? this.html.length : nextTag;
    const text = this.html.slice(this.index, end);
    this.index = end;

    if (this.isSkippingContent()) {
      return;
    }

    this.appendText(text);
  }

  private consumeTag(): void {
    const tagStart = this.index;
    const tagEnd = this.findTagEnd(tagStart + 1);
    if (tagEnd === -1) {
      this.appendText(this.html.slice(tagStart));
      this.index = this.html.length;
      return;
    }

    const rawTag = this.html.slice(tagStart + 1, tagEnd);
    this.index = tagEnd + 1;

    const parsed = parseTag(rawTag);
    if (parsed === null) {
      return;
    }

    if (parsed.closing) {
      this.closeTag(parsed.name);
      if (!this.isSkippingContent() && blockTags.has(parsed.name)) {
        this.appendNewline();
      }
      return;
    }

    const skipTag = skippedContentTags.has(parsed.name) || isHiddenElement(parsed.attributes);
    if (skipTag) {
      if (!parsed.selfClosing && !voidTags.has(parsed.name)) {
        this.skippedTagStack.push(parsed.name);
      }
      return;
    }

    if (this.isSkippingContent()) {
      if (!parsed.selfClosing && !voidTags.has(parsed.name)) {
        this.skippedTagStack.push(parsed.name);
      }
      return;
    }

    if (parsed.name === "br" || parsed.name === "hr") {
      this.appendNewline();
      return;
    }

    if (parsed.name === "img") {
      this.appendImagePlaceholder(parsed.attributes);
      return;
    }

    if (parsed.name === "li") {
      this.appendNewline();
      this.appendText("- ");
      return;
    }

    if (blockTags.has(parsed.name)) {
      this.appendNewline();
    }
  }

  private closeTag(name: string): void {
    const skipIndex = this.skippedTagStack.lastIndexOf(name);
    if (skipIndex !== -1) {
      this.skippedTagStack.splice(skipIndex, 1);
    }
  }

  private skipComment(): void {
    const end = this.html.indexOf("-->", this.index + 4);
    this.index = end === -1 ? this.html.length : end + 3;
  }

  private findTagEnd(start: number): number {
    let quote: string | null = null;

    for (let index = start; index < this.html.length; index += 1) {
      const char = this.html[index];
      if (quote !== null) {
        if (char === quote) {
          quote = null;
        }
        continue;
      }

      if (char === "\"" || char === "'") {
        quote = char;
      } else if (char === ">") {
        return index;
      }
    }

    return -1;
  }

  private startsWith(prefix: string): boolean {
    return this.html.startsWith(prefix, this.index);
  }

  private isSkippingContent(): boolean {
    return this.skippedTagStack.length > 0;
  }

  private appendText(text: string): void {
    const decoded = decodeHtmlEntities(text).replace(/\u00a0/g, " ");
    const collapsed = decoded.replace(/[ \t\f\v\r\n]+/gu, " ");
    if (collapsed.trim().length === 0) {
      this.appendSpace();
      return;
    }

    this.output += collapsed;
  }

  private appendImagePlaceholder(attributes: Record<string, string>): void {
    const alt = attributes.alt?.trim();
    const source = attributes.src?.trim();
    const sourceName = source === undefined ? undefined : decodeURIComponentSafe(source.split(/[?#]/u)[0]?.split("/").pop() ?? source);
    const label = alt !== undefined && alt.length > 0 ? alt : sourceName;

    if (label !== undefined && label.length > 0) {
      this.appendText(`[image: ${label}]`);
    } else {
      this.appendText("[image]");
    }
  }

  private appendNewline(): void {
    if (!this.output.endsWith("\n")) {
      this.output += "\n";
    }
  }

  private appendSpace(): void {
    if (this.output.length > 0 && !this.output.endsWith(" ") && !this.output.endsWith("\n")) {
      this.output += " ";
    }
  }
}

interface ParsedTag {
  readonly name: string;
  readonly closing: boolean;
  readonly selfClosing: boolean;
  readonly attributes: Record<string, string>;
}

function parseTag(rawTag: string): ParsedTag | null {
  const trimmed = rawTag.trim();
  if (trimmed.length === 0 || trimmed.startsWith("!") || trimmed.startsWith("?")) {
    return null;
  }

  const closing = trimmed.startsWith("/");
  const body = closing ? trimmed.slice(1).trimStart() : trimmed;
  const nameMatch = /^([^\s/>]+)/u.exec(body);
  if (nameMatch === null) {
    return null;
  }

  const name = nameMatch[1].toLowerCase();
  const attributesText = body.slice(nameMatch[0].length);
  const selfClosing = /\/\s*$/u.test(attributesText);

  return {
    name,
    closing,
    selfClosing,
    attributes: closing ? {} : parseAttributes(attributesText)
  };
}

function parseAttributes(attributesText: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  let index = 0;

  while (index < attributesText.length) {
    while (/\s/u.test(attributesText[index] ?? "")) {
      index += 1;
    }

    if (attributesText[index] === "/" || index >= attributesText.length) {
      break;
    }

    const nameStart = index;
    while (index < attributesText.length && !/[\s=/>]/u.test(attributesText[index])) {
      index += 1;
    }

    const name = attributesText.slice(nameStart, index).toLowerCase();
    while (/\s/u.test(attributesText[index] ?? "")) {
      index += 1;
    }

    let value = "";
    if (attributesText[index] === "=") {
      index += 1;
      while (/\s/u.test(attributesText[index] ?? "")) {
        index += 1;
      }

      const quote = attributesText[index];
      if (quote === "\"" || quote === "'") {
        index += 1;
        const valueStart = index;
        while (index < attributesText.length && attributesText[index] !== quote) {
          index += 1;
        }
        value = attributesText.slice(valueStart, index);
        if (attributesText[index] === quote) {
          index += 1;
        }
      } else {
        const valueStart = index;
        while (index < attributesText.length && !/[\s>]/u.test(attributesText[index])) {
          index += 1;
        }
        value = attributesText.slice(valueStart, index);
      }
    }

    if (name.length > 0) {
      attributes[name] = decodeHtmlEntities(value);
    }
  }

  return attributes;
}

function isHiddenElement(attributes: Record<string, string>): boolean {
  if ("hidden" in attributes || attributes["aria-hidden"]?.toLowerCase() === "true") {
    return true;
  }

  const style = attributes.style?.toLowerCase();
  return style !== undefined && (style.includes("display:none") || style.includes("display: none") || style.includes("visibility:hidden") || style.includes("visibility: hidden"));
}

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/giu, (entity, body: string) => {
    const lowerBody = body.toLowerCase();
    if (lowerBody.startsWith("#x")) {
      return codePointToString(Number.parseInt(lowerBody.slice(2), 16), entity);
    }

    if (lowerBody.startsWith("#")) {
      return codePointToString(Number.parseInt(lowerBody.slice(1), 10), entity);
    }

    const namedEntities: Record<string, string> = {
      amp: "&",
      apos: "'",
      gt: ">",
      lt: "<",
      nbsp: " ",
      quot: "\""
    };

    return namedEntities[lowerBody] ?? entity;
  });
}

function codePointToString(codePoint: number, fallback: string): string {
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return fallback;
  }

  return String.fromCodePoint(codePoint);
}

function stripCssNoise(text: string): string {
  let stripped = text.replace(/(?:^|\s)[.#]?[a-z][\w\s,.:#>+~*="'\-[\]()]+?\{[^{}]*\}/giu, " ");
  stripped = stripped.replace(/(?:^|\n)\s*(?:font-family|font-size|line-height|color|background|text-align|margin|padding|border|display|visibility|white-space)\s*:[^;\n]+;?\s*(?=\n|$)/giu, "\n");
  stripped = stripped.replace(/(?:^|\n)\s*[-a-z]+\s*:[^;\n]+;\s*(?=\n|$)/giu, "\n");
  return stripped;
}

function normalizeTerminalText(text: string): string {
  const lines = text
    .replace(/\u00a0/g, " ")
    .split(/\n/u)
    .map((line) => line.replace(/[ \t]+/gu, " ").trim())
    .filter((line, index, lines) => line.length > 0 || (index > 0 && lines[index - 1].trim().length > 0));

  const normalizedLines: string[] = [];
  for (const line of lines) {
    if (line.length === 0 && normalizedLines[normalizedLines.length - 1] === "") {
      continue;
    }
    normalizedLines.push(line);
  }

  return normalizedLines.join("\n").trim();
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
