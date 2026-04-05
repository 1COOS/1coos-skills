import { parse as parseYaml } from "yaml";

/**
 * 异步延迟
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const sleep = delay;

/**
 * 安全 JSON 解析，失败时返回默认值
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * 格式化日期（中文区域）
 */
export function formatDate(date: Date = new Date()): string {
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * 生成唯一 ID（时间戳 + 随机字符串）
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

/**
 * 截断字符串
 */
export function truncate(
  str: string,
  maxLength: number,
  suffix = "...",
): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * 非空字符串类型守卫
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * kebab-case 校验
 */
export function isKebabCase(str: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(str);
}

/**
 * 读取文件的 YAML frontmatter（支持完整 YAML 语法，包括嵌套结构）
 */
export function parseFrontmatter(
  content: string,
): { frontmatter: Record<string, unknown>; body: string } | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;

  const [, yamlStr, body] = match;

  try {
    const parsed = parseYaml(yamlStr);
    if (parsed == null || typeof parsed !== "object") {
      return { frontmatter: {}, body: body.trim() };
    }
    return { frontmatter: parsed as Record<string, unknown>, body: body.trim() };
  } catch {
    return null;
  }
}
