import { describe, expect, it } from "bun:test";
import {
  delay,
  formatDate,
  generateId,
  isKebabCase,
  isNonEmptyString,
  parseFrontmatter,
  safeJsonParse,
  truncate,
} from "./index";

describe("delay", () => {
  it("应在指定毫秒后 resolve", async () => {
    const start = Date.now();
    await delay(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
  });
});

describe("safeJsonParse", () => {
  it("应解析有效 JSON", () => {
    expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
  });

  it("无效 JSON 返回默认值", () => {
    expect(safeJsonParse("invalid", { fallback: true })).toEqual({
      fallback: true,
    });
  });
});

describe("formatDate", () => {
  it("应返回中文格式日期", () => {
    const result = formatDate(new Date(2026, 3, 5));
    expect(result).toContain("2026");
  });
});

describe("generateId", () => {
  it("应生成唯一 ID", () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
    expect(id1).toContain("-");
  });
});

describe("truncate", () => {
  it("短字符串不截断", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("长字符串截断并添加后缀", () => {
    expect(truncate("hello world", 8)).toBe("hello...");
  });
});

describe("isNonEmptyString", () => {
  it("非空字符串返回 true", () => {
    expect(isNonEmptyString("hello")).toBe(true);
  });

  it("空字符串返回 false", () => {
    expect(isNonEmptyString("")).toBe(false);
    expect(isNonEmptyString("  ")).toBe(false);
  });

  it("非字符串返回 false", () => {
    expect(isNonEmptyString(null)).toBe(false);
    expect(isNonEmptyString(123)).toBe(false);
  });
});

describe("isKebabCase", () => {
  it("有效 kebab-case", () => {
    expect(isKebabCase("my-skill")).toBe(true);
    expect(isKebabCase("skill123")).toBe(true);
    expect(isKebabCase("a-b-c")).toBe(true);
  });

  it("无效格式", () => {
    expect(isKebabCase("MySkill")).toBe(false);
    expect(isKebabCase("my_skill")).toBe(false);
    expect(isKebabCase("-leading")).toBe(false);
    expect(isKebabCase("trailing-")).toBe(false);
  });
});

describe("parseFrontmatter", () => {
  it("应解析 YAML frontmatter", () => {
    const content = `---
name: my-skill
description: A test skill
version: 1.0.0
---

# My Skill

Some content here.`;

    const result = parseFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.name).toBe("my-skill");
    expect(result!.frontmatter.description).toBe("A test skill");
    expect(result!.body).toContain("# My Skill");
  });

  it("应处理布尔值和列表", () => {
    const content = `---
disable-model-invocation: true
allowed-tools: [Read, Glob, Grep]
---

Body`;

    const result = parseFrontmatter(content);
    expect(result!.frontmatter["disable-model-invocation"]).toBe(true);
    expect(result!.frontmatter["allowed-tools"]).toEqual([
      "Read",
      "Glob",
      "Grep",
    ]);
  });

  it("无 frontmatter 返回 null", () => {
    expect(parseFrontmatter("no frontmatter here")).toBeNull();
  });
});
