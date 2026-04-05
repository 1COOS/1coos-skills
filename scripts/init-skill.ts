import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";

const PROJECT_ROOT = join(import.meta.dir, "..");
const SKILLS_DIR = join(PROJECT_ROOT, "skills");
const TEMPLATES_DIR = join(PROJECT_ROOT, "templates");

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function toDisplayName(kebab: string): string {
  return kebab
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function prompt(question: string, defaultValue = ""): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    const suffix = defaultValue ? ` (${defaultValue})` : "";
    rl.question(`${question}${suffix}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function loadTemplate(name: string): Promise<string> {
  return Bun.file(join(TEMPLATES_DIR, name)).text();
}

function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

async function main() {
  console.log("\n🔧 创建新的 Claude Code Skill\n");

  const rawName = await prompt("Skill 名称 (kebab-case)");
  if (!rawName) {
    console.error("错误: 名称不能为空");
    process.exit(1);
  }

  const name = toKebabCase(rawName);
  const displayName = toDisplayName(name);
  const description = await prompt("描述 (一句话)");
  const author = await prompt("作者", "1COOS");

  const skillDir = join(SKILLS_DIR, name);
  const scriptsDir = join(skillDir, "scripts");

  // 检查是否已存在
  if (await Bun.file(join(skillDir, "SKILL.md")).exists()) {
    console.error(`错误: skill "${name}" 已存在`);
    process.exit(1);
  }

  // 创建目录
  await mkdir(scriptsDir, { recursive: true });
  await mkdir(join(skillDir, "references"), { recursive: true });
  await mkdir(join(skillDir, "assets"), { recursive: true });

  // 模板变量
  const vars = { name, displayName, description, author };

  // 渲染并写入文件
  const skillMdTpl = await loadTemplate("SKILL.md.hbs");
  await Bun.write(join(skillDir, "SKILL.md"), renderTemplate(skillMdTpl, vars));

  const mainTsTpl = await loadTemplate("main.ts.hbs");
  await Bun.write(
    join(scriptsDir, "main.ts"),
    renderTemplate(mainTsTpl, vars),
  );

  const testTpl = await loadTemplate("main.test.ts.hbs");
  await Bun.write(
    join(scriptsDir, "main.test.ts"),
    renderTemplate(testTpl, vars),
  );

  const pkgTpl = await loadTemplate("package.json.hbs");
  await Bun.write(
    join(scriptsDir, "package.json"),
    renderTemplate(pkgTpl, vars),
  );

  console.log(`\n✅ Skill "${name}" 创建成功！\n`);
  console.log(`   目录: skills/${name}/`);
  console.log(`   SKILL.md: skills/${name}/SKILL.md`);
  console.log(`   脚本: skills/${name}/scripts/main.ts`);
  console.log(`\n后续步骤:`);
  console.log(`   1. 编辑 skills/${name}/SKILL.md 完善说明`);
  console.log(`   2. 编辑 skills/${name}/scripts/main.ts 实现逻辑`);
  console.log(`   3. 运行 bun install 链接工作区依赖`);
  console.log(`   4. 运行 cd skills/${name}/scripts && bun test 测试`);
  console.log(`   5. 运行 bun run validate -- ${name} 校验`);
}

main();
