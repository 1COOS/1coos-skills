import { describe, expect, it } from "bun:test";
import { formatObsidian } from "./formatter";

describe("formatObsidian", () => {
  it("normalizes CRLF to LF", () => {
    const result = formatObsidian("line1\r\nline2\r\n");
    expect(result).toBe("line1\nline2\n");
  });

  it("removes BOM", () => {
    const result = formatObsidian("\uFEFF# Title\n");
    expect(result).toBe("# Title\n");
  });

  it("collapses consecutive blank lines", () => {
    const result = formatObsidian("line1\n\n\n\nline2\n");
    expect(result).toBe("line1\n\nline2\n");
  });

  it("strips trailing whitespace", () => {
    const result = formatObsidian("line1   \nline2\t\n");
    expect(result).toBe("line1\nline2\n");
  });

  it("adds space after # in headings", () => {
    const result = formatObsidian("#Title\n##Subtitle\n");
    expect(result).toContain("# Title");
    expect(result).toContain("## Subtitle");
  });

  it("unifies list markers to -", () => {
    const result = formatObsidian("* item1\n+ item2\n- item3\n");
    expect(result).toBe("- item1\n- item2\n- item3\n");
  });

  it("adds space after > in blockquotes", () => {
    const result = formatObsidian(">quote\n>>nested\n");
    expect(result).toContain("> quote");
    expect(result).toContain(">> nested");
  });

  it("converts internal links to wikilinks", () => {
    const result = formatObsidian("[My Note](My Note.md)\n");
    expect(result).toContain("[[My Note]]");
  });

  it("preserves external links", () => {
    const input = "[Google](https://google.com)\n";
    const result = formatObsidian(input);
    expect(result).toContain("[Google](https://google.com)");
  });

  it("converts wikilinks with display text", () => {
    const result = formatObsidian("[Display](Target Note.md)\n");
    expect(result).toContain("[[Target Note|Display]]");
  });

  it("normalizes callout syntax", () => {
    const result = formatObsidian("> [! note ] Title\n> Content\n");
    expect(result).toContain("> [!note] Title");
  });

  it("normalizes highlight syntax", () => {
    const result = formatObsidian("==  text  ==\n");
    expect(result).toContain("==text==");
  });

  it("preserves correct highlights", () => {
    const result = formatObsidian("==highlighted==\n");
    expect(result).toContain("==highlighted==");
  });

  it("normalizes frontmatter spacing", () => {
    const input = "---\ntitle:My Note\ntags:\n  - tag1\n---\n\nContent\n";
    const result = formatObsidian(input);
    expect(result).toContain("title: My Note");
  });

  it("aligns table columns", () => {
    const input = "| Name | Age |\n| --- | --- |\n| Alice | 30 |\n";
    const result = formatObsidian(input);
    expect(result).toContain("| Name  | Age |");
    expect(result).toContain("| Alice | 30  |");
  });

  it("does not modify code blocks", () => {
    const input = "```\n* item\n#heading\n==text==\n```\n";
    const result = formatObsidian(input);
    expect(result).toContain("* item");
    expect(result).toContain("#heading");
    expect(result).toContain("==text==");
  });

  it("ensures trailing newline", () => {
    const result = formatObsidian("content");
    expect(result).toBe("content\n");
  });
});
