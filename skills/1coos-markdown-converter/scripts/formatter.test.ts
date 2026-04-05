import { describe, expect, it } from "bun:test";
import {
  formatMarkdown,
  splitByCodeBlocks,
  normalizeLineEndings,
  normalizeWhitespace,
  normalizeHeadings,
  normalizeListMarkers,
  normalizeCodeBlocks,
  normalizeBlockquotes,
  ensureTrailingNewline,
  formatTables,
  strictHeadingLevels,
  removeExcessiveFormatting,
  simplifyLinks,
  convertToWikilinks,
  normalizeCallouts,
  normalizeProperties,
  normalizeHighlights,
  DEFAULT_FORMATTING_CONFIG,
} from "./formatter";

const cfg = DEFAULT_FORMATTING_CONFIG;

// ==================== splitByCodeBlocks ====================

describe("splitByCodeBlocks", () => {
  it("returns single text segment when no code blocks", () => {
    const segments = splitByCodeBlocks("hello\nworld");
    expect(segments).toEqual([{ type: "text", content: "hello\nworld" }]);
  });

  it("correctly splits code blocks and text", () => {
    const input = "text before\n```js\nconst x = 1;\n```\ntext after";
    const segments = splitByCodeBlocks(input);
    expect(segments).toHaveLength(3);
    expect(segments[0]).toEqual({ type: "text", content: "text before" });
    expect(segments[1]).toEqual({
      type: "code",
      content: "```js\nconst x = 1;\n```",
    });
    expect(segments[2]).toEqual({ type: "text", content: "text after" });
  });

  it("handles tilde code blocks", () => {
    const input = "before\n~~~\ncode\n~~~\nafter";
    const segments = splitByCodeBlocks(input);
    expect(segments).toHaveLength(3);
    expect(segments[1].type).toBe("code");
  });

  it("marks unclosed code blocks as code type", () => {
    const input = "text\n```\nunclosed code";
    const segments = splitByCodeBlocks(input);
    const lastSegment = segments[segments.length - 1];
    expect(lastSegment.type).toBe("code");
  });
});

// ==================== normalizeLineEndings ====================

describe("normalizeLineEndings", () => {
  it("converts CRLF to LF", () => {
    expect(normalizeLineEndings("a\r\nb\r\n", cfg)).toBe("a\nb\n");
  });

  it("removes BOM", () => {
    expect(normalizeLineEndings("\uFEFFhello", cfg)).toBe("hello");
  });

  it("converts CR to LF", () => {
    expect(normalizeLineEndings("a\rb", cfg)).toBe("a\nb");
  });
});

// ==================== normalizeWhitespace ====================

describe("normalizeWhitespace", () => {
  it("strips trailing whitespace", () => {
    const result = normalizeWhitespace("hello   \nworld\t\n", cfg);
    expect(result).toBe("hello\nworld\n");
  });

  it("collapses consecutive blank lines", () => {
    const result = normalizeWhitespace("a\n\n\n\nb", cfg);
    expect(result).toBe("a\n\nb");
  });

  it("preserves code block content", () => {
    const input = "text   \n```\ncode   \n```\nmore   ";
    const result = normalizeWhitespace(input, cfg);
    expect(result).toContain("code   ");
    expect(result).not.toContain("text   ");
  });
});

// ==================== normalizeHeadings ====================

describe("normalizeHeadings", () => {
  it("adds space after # when missing", () => {
    expect(normalizeHeadings("#title", cfg)).toBe("# title");
    expect(normalizeHeadings("##title", cfg)).toBe("## title");
  });

  it("leaves headings with space unchanged", () => {
    expect(normalizeHeadings("# title", cfg)).toBe("# title");
  });

  it("does not modify content inside code blocks", () => {
    const input = "```\n#comment\n```";
    expect(normalizeHeadings(input, cfg)).toBe(input);
  });
});

// ==================== normalizeListMarkers ====================

describe("normalizeListMarkers", () => {
  it("replaces * and + with configured marker", () => {
    const result = normalizeListMarkers("* item1\n+ item2\n- item3", cfg);
    expect(result).toBe("- item1\n- item2\n- item3");
  });

  it("preserves indentation", () => {
    const result = normalizeListMarkers("  * nested", cfg);
    expect(result).toBe("  - nested");
  });

  it("does not modify content inside code blocks", () => {
    const input = "```\n* not a list\n```";
    expect(normalizeListMarkers(input, cfg)).toBe(input);
  });
});

// ==================== normalizeCodeBlocks ====================

describe("normalizeCodeBlocks", () => {
  it("adds blank lines around code blocks", () => {
    const input = "text\n```\ncode\n```\ntext";
    const result = normalizeCodeBlocks(input, cfg);
    expect(result).toBe("text\n\n```\ncode\n```\n\ntext");
  });

  it("does not add duplicate blank lines", () => {
    const input = "text\n\n```\ncode\n```\n\ntext";
    const result = normalizeCodeBlocks(input, cfg);
    expect(result).toBe(input);
  });
});

// ==================== normalizeBlockquotes ====================

describe("normalizeBlockquotes", () => {
  it("adds space after > when missing", () => {
    expect(normalizeBlockquotes(">quote", cfg)).toBe("> quote");
    expect(normalizeBlockquotes(">>nested", cfg)).toBe(">> nested");
  });

  it("leaves blockquotes with space unchanged", () => {
    expect(normalizeBlockquotes("> quote", cfg)).toBe("> quote");
  });
});

// ==================== ensureTrailingNewline ====================

describe("ensureTrailingNewline", () => {
  it("adds trailing newline", () => {
    expect(ensureTrailingNewline("text", cfg)).toBe("text\n");
  });

  it("collapses multiple trailing newlines to one", () => {
    expect(ensureTrailingNewline("text\n\n\n", cfg)).toBe("text\n");
  });

  it("leaves single trailing newline unchanged", () => {
    expect(ensureTrailingNewline("text\n", cfg)).toBe("text\n");
  });
});

// ==================== formatTables (github) ====================

describe("formatTables", () => {
  it("aligns table columns", () => {
    const input =
      "| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |";
    const result = formatTables(input, cfg);
    const lines = result.split("\n");
    expect(lines.length).toBe(4);
    for (const line of lines) {
      expect(line.startsWith("|")).toBe(true);
      expect(line.endsWith("|")).toBe(true);
    }
  });

  it("preserves alignment markers", () => {
    const input =
      "| Left | Center | Right |\n| :--- | :---: | ---: |\n| a | b | c |";
    const result = formatTables(input, cfg);
    expect(result).toContain(":");
  });
});

// ==================== strictHeadingLevels (commonmark) ====================

describe("strictHeadingLevels", () => {
  it("fixes skipped heading levels", () => {
    const input = "# Title\n### Skipped";
    const result = strictHeadingLevels(input, cfg);
    expect(result).toBe("# Title\n## Skipped");
  });

  it("leaves sequential levels unchanged", () => {
    const input = "# Title\n## Subtitle";
    const result = strictHeadingLevels(input, cfg);
    expect(result).toBe(input);
  });
});

// ==================== removeExcessiveFormatting (clean) ====================

describe("removeExcessiveFormatting", () => {
  it("removes empty emphasis markers", () => {
    const result = removeExcessiveFormatting("text****text", cfg);
    expect(result).toBe("texttext");
  });
});

// ==================== simplifyLinks (clean) ====================

describe("simplifyLinks", () => {
  it("simplifies links where text equals URL", () => {
    const result = simplifyLinks(
      "[https://example.com](https://example.com)",
      cfg,
    );
    expect(result).toBe("<https://example.com>");
  });

  it("leaves normal links unchanged", () => {
    const input = "[Example](https://example.com)";
    expect(simplifyLinks(input, cfg)).toBe(input);
  });
});

// ==================== convertToWikilinks (obsidian) ====================

describe("convertToWikilinks", () => {
  it("converts internal .md links to wikilinks", () => {
    const result = convertToWikilinks("[My Note](My Note.md)", cfg);
    expect(result).toBe("[[My Note]]");
  });

  it("preserves | syntax for different display text", () => {
    const result = convertToWikilinks("[Display](Target Note.md)", cfg);
    expect(result).toBe("[[Target Note|Display]]");
  });

  it("leaves external links unchanged", () => {
    const input = "[Google](https://google.com)";
    expect(convertToWikilinks(input, cfg)).toBe(input);
  });

  it("leaves anchor links unchanged", () => {
    const input = "[Section](#heading)";
    expect(convertToWikilinks(input, cfg)).toBe(input);
  });

  it("handles internal links without .md suffix", () => {
    const result = convertToWikilinks("[Note](Note)", cfg);
    expect(result).toBe("[[Note]]");
  });
});

// ==================== normalizeCallouts (obsidian) ====================

describe("normalizeCallouts", () => {
  it("normalizes callout type whitespace", () => {
    const result = normalizeCallouts("> [! note ]\n> Content", cfg);
    expect(result).toContain("> [!note]");
  });

  it("leaves correct format unchanged", () => {
    const input = "> [!warning] Title\n> Content here";
    expect(normalizeCallouts(input, cfg)).toBe(input);
  });
});

// ==================== normalizeProperties (obsidian) ====================

describe("normalizeProperties", () => {
  it("normalizes frontmatter key:value format", () => {
    const input = "---\ntitle:My Note\ntags:\n  - tag1\n---\n\nContent";
    const result = normalizeProperties(input, cfg);
    expect(result).toContain("title: My Note");
  });

  it("leaves content without frontmatter unchanged", () => {
    const input = "# Just a heading\n\nContent";
    expect(normalizeProperties(input, cfg)).toBe(input);
  });
});

// ==================== normalizeHighlights (obsidian) ====================

describe("normalizeHighlights", () => {
  it("strips extra whitespace inside highlight markers", () => {
    const result = normalizeHighlights("==  text  ==", cfg);
    expect(result).toBe("==text==");
  });

  it("leaves correct highlights unchanged", () => {
    const input = "==highlighted==";
    expect(normalizeHighlights(input, cfg)).toBe(input);
  });
});

// ==================== formatMarkdown integration ====================

describe("formatMarkdown", () => {
  const messyInput = [
    "\uFEFF#Title\r\n",
    "\r\n",
    "\r\n",
    "\r\n",
    "* item1   \r\n",
    "+ item2\r\n",
    "\r\n",
    ">quote\r\n",
    "\r\n",
    "```js\r\n",
    "const x = 1;   \r\n",
    "```\r\n",
    "\r\n",
    "end",
  ].join("");

  it("github style full processing", () => {
    const result = formatMarkdown(messyInput, "github");
    expect(result).toContain("# Title");
    expect(result).toContain("- item1");
    expect(result).toContain("- item2");
    expect(result).toContain("> quote");
    // Code block content should be preserved (including trailing whitespace)
    expect(result).toContain("const x = 1;   ");
    expect(result).toEndWith("\n");
  });

  it("commonmark style full processing", () => {
    const result = formatMarkdown(messyInput, "commonmark");
    expect(result).toContain("# Title");
    expect(result).toContain("- item1");
    expect(result).toEndWith("\n");
  });

  it("clean style full processing", () => {
    const result = formatMarkdown(messyInput, "clean");
    expect(result).toContain("# Title");
    expect(result).toEndWith("\n");
  });

  it("obsidian style full processing", () => {
    const obsidianInput = [
      "---\n",
      "title:My Note\n",
      "tags:\n",
      "  - test\n",
      "---\n",
      "\n",
      "#Title\n",
      "\n",
      "[Related](Related.md)\n",
      "\n",
      "> [! note ] Important\n",
      "> Some content\n",
      "\n",
      "==  highlighted  ==\n",
    ].join("");
    const result = formatMarkdown(obsidianInput, "obsidian");
    expect(result).toContain("title: My Note");
    expect(result).toContain("# Title");
    expect(result).toContain("[[Related]]");
    expect(result).toContain("[!note]");
    expect(result).toContain("==highlighted==");
    expect(result).toEndWith("\n");
  });

  it("throws on unsupported style", () => {
    expect(() => formatMarkdown("test", "unknown" as any)).toThrow(
      "Unsupported style",
    );
  });

  it("accepts custom config overrides", () => {
    const result = formatMarkdown("* item", "github", { listMarker: "+" });
    expect(result).toContain("+ item");
  });
});
