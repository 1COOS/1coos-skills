/**
 * Markdown formatting engine
 * Pipeline-based transform architecture, supports github / commonmark / clean / obsidian styles
 */

export type FormatStyle = "github" | "commonmark" | "clean" | "obsidian";

export interface FormattingConfig {
  maxWidth: number;
  listMarker: string;
  emphasisMarker: string;
  strongMarker: string;
  codeBlockStyle: string;
}

export const DEFAULT_FORMATTING_CONFIG: FormattingConfig = {
  maxWidth: 80,
  listMarker: "-",
  emphasisMarker: "*",
  strongMarker: "**",
  codeBlockStyle: "fenced",
};

// ==================== Code block protection ====================

interface ContentSegment {
  type: "text" | "code";
  content: string;
}

/**
 * Split markdown content into text and code segments by fenced code blocks
 */
export function splitByCodeBlocks(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const lines = content.split("\n");
  let inCodeBlock = false;
  let currentLines: string[] = [];
  let codeFence = "";

  for (const line of lines) {
    const fenceMatch = line.match(/^(`{3,}|~{3,})/);

    if (!inCodeBlock && fenceMatch) {
      // Entering code block: save preceding text segment
      if (currentLines.length > 0) {
        segments.push({ type: "text", content: currentLines.join("\n") });
        currentLines = [];
      }
      inCodeBlock = true;
      codeFence = fenceMatch[1][0]; // ` or ~
      currentLines.push(line);
    } else if (inCodeBlock && line.match(new RegExp(`^${codeFence}{3,}\\s*$`))) {
      // Leaving code block
      currentLines.push(line);
      segments.push({ type: "code", content: currentLines.join("\n") });
      currentLines = [];
      inCodeBlock = false;
      codeFence = "";
    } else {
      currentLines.push(line);
    }
  }

  // Remaining content
  if (currentLines.length > 0) {
    segments.push({
      type: inCodeBlock ? "code" : "text",
      content: currentLines.join("\n"),
    });
  }

  return segments;
}

/**
 * Apply transform only to non-code-block segments
 */
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

// ==================== Common transforms ====================

/** CRLF -> LF, remove BOM */
export function normalizeLineEndings(
  content: string,
  _config: FormattingConfig,
): string {
  let result = content.replace(/^\uFEFF/, "");
  result = result.replace(/\r\n/g, "\n");
  result = result.replace(/\r/g, "\n");
  return result;
}

/** Strip trailing whitespace, collapse consecutive blank lines (keep at most one) */
export function normalizeWhitespace(
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
export function normalizeHeadings(
  content: string,
  _config: FormattingConfig,
): string {
  return applyToTextSegments(content, (text) => {
    return text.replace(/^(#{1,6})([^ #\n])/gm, "$1 $2");
  });
}

/** Unify unordered list markers */
export function normalizeListMarkers(
  content: string,
  config: FormattingConfig,
): string {
  const marker = config.listMarker;
  return applyToTextSegments(content, (text) => {
    return text.replace(/^(\s*)[*+](\s)/gm, `$1${marker}$2`);
  });
}

/** Ensure blank lines before and after code blocks */
export function normalizeCodeBlocks(
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
      // Code block start: need blank line before
      if (result.length > 0 && result[result.length - 1] !== "") {
        result.push("");
      }
      inCodeBlock = true;
      result.push(line);
    } else if (isFence && inCodeBlock) {
      // Code block end: need blank line after
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
export function normalizeBlockquotes(
  content: string,
  _config: FormattingConfig,
): string {
  return applyToTextSegments(content, (text) => {
    return text.replace(/^(>+)([^ >\n])/gm, "$1 $2");
  });
}

/** Ensure file ends with exactly one newline */
export function ensureTrailingNewline(
  content: string,
  _config: FormattingConfig,
): string {
  return content.replace(/\n*$/, "\n");
}

// ==================== GitHub style transforms ====================

/** Align table columns */
export function formatTables(
  content: string,
  _config: FormattingConfig,
): string {
  return applyToTextSegments(content, (text) => {
    const lines = text.split("\n");
    const result: string[] = [];
    let tableLines: string[] = [];
    let inTable = false;

    const flushTable = () => {
      if (tableLines.length >= 2) {
        const formatted = alignTable(tableLines);
        result.push(...formatted);
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

/** Align table columns to consistent widths */
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
      // Separator rows (---) don't contribute to width
      const cell = row[i];
      if (!/^[-:]+$/.test(cell)) {
        colWidths[i] = Math.max(colWidths[i], cell.length);
      }
    }
  }

  // Minimum column width of 3 (for ---)
  for (let i = 0; i < colWidths.length; i++) {
    colWidths[i] = Math.max(colWidths[i], 3);
  }

  return rows.map((row) => {
    const cells = row.map((cell, i) => {
      const width = colWidths[i] || 3;
      if (/^[-:]+$/.test(cell)) {
        // Separator row: preserve alignment markers
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

// ==================== CommonMark style transforms ====================

/** Ensure heading levels don't skip (e.g. # -> ### becomes # -> ##) */
export function strictHeadingLevels(
  content: string,
  _config: FormattingConfig,
): string {
  return applyToTextSegments(content, (text) => {
    const lines = text.split("\n");
    let lastLevel = 0;
    const result: string[] = [];

    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s/);
      if (match) {
        let level = match[1].length;
        if (lastLevel > 0 && level > lastLevel + 1) {
          level = lastLevel + 1;
        }
        lastLevel = level;
        result.push("#".repeat(level) + line.slice(match[1].length));
      } else {
        result.push(line);
      }
    }

    return result.join("\n");
  });
}

// ==================== Clean style transforms ====================

/** Remove empty/redundant emphasis markers */
export function removeExcessiveFormatting(
  content: string,
  _config: FormattingConfig,
): string {
  return applyToTextSegments(content, (text) => {
    // Remove empty bold markers
    let result = text.replace(/\*\*\*\*/g, "");
    result = result.replace(/\*\*/g, (match, offset, str) => {
      const after = str.slice(offset + 2);
      if (after.startsWith("**")) return "";
      return match;
    });
    // Remove empty italic markers
    result = result.replace(/(?<!\*)\*([^*]*)\*(?!\*)/g, (match, inner) => {
      return inner.trim() === "" ? "" : match;
    });
    return result;
  });
}

/** Simplify links where display text equals URL */
export function simplifyLinks(
  content: string,
  _config: FormattingConfig,
): string {
  return applyToTextSegments(content, (text) => {
    // [https://example.com](https://example.com) -> <https://example.com>
    return text.replace(
      /\[([^\]]+)\]\((\1)\)/g,
      "<$1>",
    );
  });
}

// ==================== Obsidian style transforms ====================

/** Convert standard markdown links to wikilinks (internal links) */
export function convertToWikilinks(
  content: string,
  _config: FormattingConfig,
): string {
  return applyToTextSegments(content, (text) => {
    // [Display Text](Note Name.md) -> [[Note Name|Display Text]]
    // [Note Name](Note Name.md) -> [[Note Name]]
    return text.replace(
      /\[([^\]]+)\]\(([^)]+?)(?:\.md)?\)/g,
      (_match, displayText: string, target: string) => {
        // Skip external links (http/https) and anchor links
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

/** Normalize callout syntax (ensure > [!type] format is correct) */
export function normalizeCallouts(
  content: string,
  _config: FormattingConfig,
): string {
  return applyToTextSegments(content, (text) => {
    // Normalize: > [! type ] -> > [!type]
    let result = text.replace(
      /^(>\s*)\[!\s*(\w+)\s*\]/gm,
      "$1[!$2]",
    );
    // Ensure callout content lines have > prefix
    const lines = result.split("\n");
    const output: string[] = [];
    let inCallout = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Detect callout start
      if (/^>\s*\[!\w+\]/.test(line)) {
        inCallout = true;
        output.push(line);
        continue;
      }
      // Inside callout: lines starting with > continue
      if (inCallout && /^>/.test(line)) {
        output.push(line);
        continue;
      }
      // Empty line ends callout
      if (inCallout && line.trim() === "") {
        inCallout = false;
      }
      output.push(line);
    }

    return output.join("\n");
  });
}

/** Normalize Obsidian properties/frontmatter format */
export function normalizeProperties(
  content: string,
  _config: FormattingConfig,
): string {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return content;

  const fmContent = fmMatch[1];
  const lines = fmContent.split("\n");
  const normalizedLines: string[] = [];

  for (const line of lines) {
    // Normalize key:value spacing (key:value -> key: value)
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

/** Normalize Obsidian highlight syntax ==text== */
export function normalizeHighlights(
  content: string,
  _config: FormattingConfig,
): string {
  return applyToTextSegments(content, (text) => {
    // Fix == text == -> ==text== (strip inner whitespace)
    return text.replace(/==\s+([^=]+?)\s+==/g, "==$1==");
  });
}

// ==================== Style pipelines ====================

const COMMON_TRANSFORMS: Transform[] = [
  normalizeLineEndings,
  normalizeWhitespace,
  normalizeHeadings,
  normalizeListMarkers,
  normalizeCodeBlocks,
  normalizeBlockquotes,
];

const STYLE_PIPELINES: Record<FormatStyle, Transform[]> = {
  github: [...COMMON_TRANSFORMS, formatTables, ensureTrailingNewline],
  commonmark: [
    ...COMMON_TRANSFORMS,
    strictHeadingLevels,
    ensureTrailingNewline,
  ],
  clean: [
    ...COMMON_TRANSFORMS,
    removeExcessiveFormatting,
    simplifyLinks,
    ensureTrailingNewline,
  ],
  obsidian: [
    ...COMMON_TRANSFORMS,
    normalizeProperties,
    convertToWikilinks,
    normalizeCallouts,
    normalizeHighlights,
    formatTables,
    ensureTrailingNewline,
  ],
};

/**
 * Format markdown content using the specified style
 */
export function formatMarkdown(
  content: string,
  style: FormatStyle = "obsidian",
  config: Partial<FormattingConfig> = {},
): string {
  const fullConfig = { ...DEFAULT_FORMATTING_CONFIG, ...config };
  const pipeline = STYLE_PIPELINES[style];
  if (!pipeline) {
    throw new Error(`Unsupported style: ${style}`);
  }
  return pipeline.reduce((text, transform) => transform(text, fullConfig), content);
}
