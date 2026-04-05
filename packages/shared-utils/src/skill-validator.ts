import { isKebabCase, isNonEmptyString, parseFrontmatter } from "./index";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SkillFrontmatter {
  name?: string;
  description?: string;
  version?: string;
  "argument-hint"?: string;
  "allowed-tools"?: string[];
  model?: string;
  "disable-model-invocation"?: boolean;
  "user-invocable"?: boolean;
  effort?: string;
  context?: string;
  agent?: string;
  paths?: string[];
  [key: string]: unknown;
}

const VALID_EFFORT_LEVELS = ["low", "medium", "high", "max"];
const VALID_TOOLS = [
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  "Bash",
  "Agent",
  "WebFetch",
  "WebSearch",
  "NotebookEdit",
];

/**
 * 校验 SKILL.md 文件内容
 */
export function validateSkillMd(content: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const parsed = parseFrontmatter(content);
  if (!parsed) {
    errors.push("缺少 YAML frontmatter（文件必须以 --- 开头和结尾）");
    return { valid: false, errors, warnings };
  }

  const { frontmatter, body } = parsed;
  const fm = frontmatter as SkillFrontmatter;

  // name 校验
  if (fm.name) {
    if (typeof fm.name !== "string") {
      errors.push("name 必须是字符串");
    } else {
      if (!isKebabCase(fm.name)) {
        errors.push("name 必须是 kebab-case 格式（小写字母、数字、连字符）");
      }
      if (fm.name.length > 64) {
        errors.push("name 最长 64 个字符");
      }
    }
  }

  // description 校验
  if (!isNonEmptyString(fm.description)) {
    warnings.push("建议提供 description 字段以提高 skill 可发现性");
  } else if (fm.description.length > 250) {
    warnings.push("description 超过 250 字符，在市场列表中会被截断");
  }

  // version 校验
  if (fm.version) {
    if (!/^\d+\.\d+\.\d+/.test(String(fm.version))) {
      errors.push("version 必须是语义化版本格式（如 1.0.0）");
    }
  }

  // effort 校验
  if (fm.effort && !VALID_EFFORT_LEVELS.includes(String(fm.effort))) {
    errors.push(`effort 必须是以下之一: ${VALID_EFFORT_LEVELS.join(", ")}`);
  }

  // context 校验
  if (fm.context && fm.context !== "fork") {
    errors.push('context 目前只支持 "fork"');
  }

  // allowed-tools 校验
  if (fm["allowed-tools"]) {
    const tools = Array.isArray(fm["allowed-tools"])
      ? fm["allowed-tools"]
      : String(fm["allowed-tools"]).split(/\s+/);
    for (const tool of tools) {
      // 允许带参数的工具如 Bash(bun test*)
      const toolName = tool.replace(/\(.*\)$/, "");
      if (!VALID_TOOLS.includes(toolName)) {
        warnings.push(`未知工具: ${tool}`);
      }
    }
  }

  // body 校验
  if (!body || body.trim().length === 0) {
    warnings.push("SKILL.md body 为空，建议添加使用说明");
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * 校验 skill 目录结构
 */
export async function validateSkillDir(
  skillDir: string,
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const skillMdPath = `${skillDir}/SKILL.md`;
  const skillMdFile = Bun.file(skillMdPath);

  if (!(await skillMdFile.exists())) {
    errors.push(`缺少 SKILL.md 文件: ${skillMdPath}`);
    return { valid: false, errors, warnings };
  }

  const content = await skillMdFile.text();
  const mdResult = validateSkillMd(content);
  errors.push(...mdResult.errors);
  warnings.push(...mdResult.warnings);

  // 检查 scripts 目录
  const scriptsDir = `${skillDir}/scripts`;
  const scriptsPkgPath = `${scriptsDir}/package.json`;
  const scriptsPkgFile = Bun.file(scriptsPkgPath);

  if (await scriptsPkgFile.exists()) {
    const mainTsFile = Bun.file(`${scriptsDir}/main.ts`);
    if (!(await mainTsFile.exists())) {
      warnings.push("scripts/ 目录缺少 main.ts 入口文件");
    }

    const testFile = Bun.file(`${scriptsDir}/main.test.ts`);
    if (!(await testFile.exists())) {
      warnings.push("scripts/ 目录缺少 main.test.ts 测试文件");
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
