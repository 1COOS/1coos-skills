/**
 * Obsidian-style Markdown formatting engine (self-contained)
 * Pipeline-based transforms with code block protection
 */

export interface FormattingConfig {
  maxWidth: number;
  listMarker: string;
}

export const DEFAULT_FORMATTING_CONFIG: FormattingConfig = {
  maxWidth: 80,
  listMarker: "-",
};

// ==================== Code block protection ====================

interface ContentSegment {
  type: "text" | "code";
  content: string;
}

/** Split markdown into text and code segments by fenced code blocks */
function splitByCodeBlocks(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const lines = content.split("\n");
  let inCodeBlock = false;
  let currentLines: string[] = [];
  let codeFence = "";

  for (const line of lines) {
    const fenceMatch = line.match(/^(`{3,}|~{3,})/);

    if (!inCodeBlock && fenceMatch) {
      if (currentLines.length > 0) {
        segments.push({ type: "text", content: currentLines.join("\n") });
        currentLines = [];
      }
      inCodeBlock = true;
      codeFence = fenceMatch[1][0];
      currentLines.push(line);
    } else if (
      inCodeBlock &&
      line.match(new RegExp(`^${codeFence}{3,}\\s*$`))
    ) {
      currentLines.push(line);
      segments.push({ type: "code", content: currentLines.join("\n") });
      currentLines = [];
      inCodeBlock = false;
      codeFence = "";
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    segments.push({
      type: inCodeBlock ? "code" : "text",
      content: currentLines.join("\n"),
    });
  }

  return segments;
}

/** Apply transform only to non-code-block segments */
function applyToTextSegments(
  content: string,
  transform: (text: string) => string,
): string {
  const segments = splitByCodeBlocks(content);
  return segments
    .map((seg) => (seg.type === "text" ? transform(seg.content) : seg.content))
    .join("\n");
}

type Transform = (content: string, config: FormattingConfig) => string;

// ==================== Transforms ====================

/** CRLF -> LF, remove BOM */
function normalizeLineEndings(
  content: string,
  _config: FormattingConfig,
): string {
  let result = content.replace(/^\uFEFF/, "");
  result = result.replace(/\r\n/g, "\n");
  result = result.replace(/\r/g, "\n");
  return result;
}

/** Strip trailing whitespace, collapse consecutive blank lines */
function normalizeWhitespace(
  content: string,
  _config: FormattingConfig,
): string {
  return applyToTextSegments(content, (text) => {
    let result = text.replace(/[ \t]+$/gm, "");
    result = result.replace(/\n{3,}/g, "\n\n");
    return result;
  });
}

/** Ensure a space after # in headings */
function normalizeHeadings(
  content: string,
  _config: FormattingConfig,
): string {
  return applyToTextSegments(content, (text) => {
    return text.replace(/^(#{1,6})([^ #\n])/gm, "$1 $2");
  });
}

/** Unify unordered list markers */
function normalizeListMarkers(
  content: string,
  config: FormattingConfig,
): string {
  const marker = config.listMarker;
  return applyToTextSegments(content, (text) => {
    return text.replace(/^(\s*)[*+](\s)/gm, `$1${marker}$2`);
  });
}

/** Ensure blank lines before and after code blocks */
function normalizeCodeBlocks(
  content: string,
  _config: FormattingConfig,
): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isFence = /^(`{3,}|~{3,})/.test(line);

    if (isFence && !inCodeBlock) {
      if (result.length > 0 && result[result.length - 1] !== "") {
        result.push("");
      }
      inCodeBlock = true;
      result.push(line);
    } else if (isFence && inCodeBlock) {
      inCodeBlock = false;
      result.push(line);
      if (i + 1 < lines.length && lines[i + 1] !== "") {
        result.push("");
      }
    } else {
      result.push(line);
    }
  }

  return result.join("\n");
}

/** Ensure a space after > in blockquotes */
function normalizeBlockquotes(
  content: string,
  _config: FormattingConfig,
): string {
  return applyToTextSegments(content, (text) => {
    return text.replace(/^(>+)([^ >\n])/gm, "$1 $2");
  });
}

/** Normalize Obsidian properties/frontmatter format */
function normalizeProperties(
  content: string,
  _config: FormattingConfig,
): string {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return content;

  const fmContent = fmMatch[1];
  const lines = fmContent.split("\n");
  const normalizedLines: string[] = [];

  for (const line of lines) {
    const kvMatch = line.match(/^(\s*)(\w[\w-]*):\s*(.*)/);
    if (kvMatch) {
      const [, indent, key, value] = kvMatch;
      normalizedLines.push(`${indent}${key}: ${value}`);
    } else {
      normalizedLines.push(line);
    }
  }

  return content.replace(
    fmMatch[0],
    `---\n${normalizedLines.join("\n")}\n---`,
  );
}

/** Convert standard markdown links to wikilinks (internal links only) */
function convertToWikilinks(
  content: string,
  _config: FormattingConfig,
): string {
  return applyToTextSegments(content, (text) => {
    return text.replace(
      /\[([^\]]+)\]\(([^)]+?)(?:\.md)?\)/g,
      (_match, displayText: string, target: string) => {
        if (/^https?:\/\//.test(target) || target.startsWith("#")) {
          return _match;
        }
        const name = target.replace(/\.md$/, "");
        if (displayText === name || displayText === target) {
          return `[[${name}]]`;
        }
        return `[[${name}|${displayText}]]`;
      },
    );
  });
}

/** Normalize callout syntax > [!type] */
function normalizeCallouts(
  content: string,
  _config: FormattingConfig,
): string {
  return applyToTextSegments(content, (text) => {
    let result = text.replace(/^(>\s*)\[!\s*(\w+)\s*\]/gm, "$1[!$2]");

    const lines = result.split("\n");
    const output: string[] = [];
    let inCallout = false;

    for (const line of lines) {
      if (/^>\s*\[!\w+\]/.test(line)) {
        inCallout = true;
        output.push(line);
        continue;
      }
      if (inCallout && /^>/.test(line)) {
        output.push(line);
        continue;
      }
      if (inCallout && line.trim() === "") {
        inCallout = false;
      }
      output.push(line);
    }

    return output.join("\n");
  });
}

/** Normalize ==highlight== syntax */
function normalizeHighlights(
  content: string,
  _config: FormattingConfig,
): string {
  return applyToTextSegments(content, (text) => {
    return text.replace(/==\s+([^=]+?)\s+==/g, "==$1==");
  });
}

/** Align table columns */
function formatTables(content: string, _config: FormattingConfig): string {
  return applyToTextSegments(content, (text) => {
    const lines = text.split("\n");
    const result: string[] = [];
    let tableLines: string[] = [];
    let inTable = false;

    const flushTable = () => {
      if (tableLines.length >= 2) {
        result.push(...alignTable(tableLines));
      } else {
        result.push(...tableLines);
      }
      tableLines = [];
      inTable = false;
    };

    for (const line of lines) {
      const isTableLine = /^\s*\|/.test(line) && /\|\s*$/.test(line);
      if (isTableLine) {
        inTable = true;
        tableLines.push(line);
      } else {
        if (inTable) flushTable();
        result.push(line);
      }
    }
    if (inTable) flushTable();

    return result.join("\n");
  });
}

function alignTable(lines: string[]): string[] {
  const rows = lines.map((line) =>
    line
      .replace(/^\s*\|\s*/, "")
      .replace(/\s*\|\s*$/, "")
      .split(/\s*\|\s*/),
  );

  const colCount = Math.max(...rows.map((r) => r.length));
  const colWidths: number[] = Array(colCount).fill(0);

  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      const cell = row[i];
      if (!/^[-:]+$/.test(cell)) {
        colWidths[i] = Math.max(colWidths[i], cell.length);
      }
    }
  }

  for (let i = 0; i < colWidths.length; i++) {
    colWidths[i] = Math.max(colWidths[i], 3);
  }

  return rows.map((row) => {
    const cells = row.map((cell, i) => {
      const width = colWidths[i] || 3;
      if (/^[-:]+$/.test(cell)) {
        const leftAlign = cell.startsWith(":");
        const rightAlign = cell.endsWith(":");
        if (leftAlign && rightAlign) {
          return ":" + "-".repeat(width - 2) + ":";
        } else if (rightAlign) {
          return "-".repeat(width - 1) + ":";
        } else if (leftAlign) {
          return ":" + "-".repeat(width - 1);
        }
        return "-".repeat(width);
      }
      return cell.padEnd(width);
    });
    return "| " + cells.join(" | ") + " |";
  });
}

/** Ensure file ends with exactly one newline */
function ensureTrailingNewline(
  content: string,
  _config: FormattingConfig,
): string {
  return content.replace(/\n*$/, "\n");
}

// ==================== Pipeline ====================

const OBSIDIAN_PIPELINE: Transform[] = [
  normalizeLineEndings,
  normalizeWhitespace,
  normalizeHeadings,
  normalizeListMarkers,
  normalizeCodeBlocks,
  normalizeBlockquotes,
  normalizeProperties,
  convertToWikilinks,
  normalizeCallouts,
  normalizeHighlights,
  formatTables,
  ensureTrailingNewline,
];

/**
 * Format markdown content using Obsidian style
 */
export function formatObsidian(
  content: string,
  config: Partial<FormattingConfig> = {},
): string {
  const fullConfig = { ...DEFAULT_FORMATTING_CONFIG, ...config };
  return OBSIDIAN_PIPELINE.reduce(
    (text, transform) => transform(text, fullConfig),
    content,
  );
}
