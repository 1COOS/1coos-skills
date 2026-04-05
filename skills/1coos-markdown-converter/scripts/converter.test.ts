import { describe, expect, it } from "bun:test";
import { checkUvxAvailable, convertToMarkdown } from "./converter";

describe("checkUvxAvailable", () => {
  it("returns a boolean without throwing", async () => {
    const result = await checkUvxAvailable();
    expect(typeof result).toBe("boolean");
  });
});

describe("convertToMarkdown", () => {
  it("returns failure for non-existent file", async () => {
    const result = await convertToMarkdown("/nonexistent/file.pdf");
    expect(result.success).toBe(false);
    expect(result.error).toContain("File not found");
  });

  it("returns ConvertResult structure", async () => {
    const result = await convertToMarkdown("/nonexistent/file.pdf");
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("markdown");
  });
});
