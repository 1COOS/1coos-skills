import { describe, expect, it } from "bun:test";
import { extractFirstUrl } from "./url-extractor";

describe("extractFirstUrl", () => {
  it("extracts simple URL", () => {
    expect(extractFirstUrl("https://example.com")).toBe("https://example.com");
  });

  it("extracts URL from mixed text", () => {
    expect(extractFirstUrl("check this https://x.com/user/123 out")).toBe(
      "https://x.com/user/123",
    );
  });

  it("extracts URL from CJK text", () => {
    expect(
      extractFirstUrl("看看这个https://weixin.qq.com/article/123很有意思"),
    ).toBe("https://weixin.qq.com/article/123");
  });

  it("returns null when no URL present", () => {
    expect(extractFirstUrl("no url here")).toBeNull();
  });

  it("extracts first URL when multiple present", () => {
    expect(
      extractFirstUrl("https://first.com and https://second.com"),
    ).toBe("https://first.com");
  });

  it("handles URL with query parameters", () => {
    expect(
      extractFirstUrl("https://youtube.com/watch?v=abc&t=123"),
    ).toBe("https://youtube.com/watch?v=abc&t=123");
  });

  it("strips trailing punctuation", () => {
    expect(extractFirstUrl("visit https://example.com.")).toBe(
      "https://example.com",
    );
    expect(extractFirstUrl("see https://example.com, then")).toBe(
      "https://example.com",
    );
  });

  it("handles balanced parentheses in URL (Wikipedia)", () => {
    expect(
      extractFirstUrl(
        "https://en.wikipedia.org/wiki/Rust_(programming_language)",
      ),
    ).toBe("https://en.wikipedia.org/wiki/Rust_(programming_language)");
  });

  it("handles http:// URLs", () => {
    expect(extractFirstUrl("http://old-site.com/page")).toBe(
      "http://old-site.com/page",
    );
  });

  it("handles URL followed by Chinese punctuation", () => {
    expect(extractFirstUrl("链接https://example.com/path。后面的文字")).toBe(
      "https://example.com/path",
    );
  });
});
