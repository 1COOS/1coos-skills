import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { validateSkillDir } from "@1coos/shared-utils/validator";

const PROJECT_ROOT = join(import.meta.dir, "..");
const SKILLS_DIR = join(PROJECT_ROOT, "skills");

interface SkillResult {
  name: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  testsPassed: boolean | null;
}

async function runTests(skillDir: string): Promise<boolean> {
  const scriptsDir = join(skillDir, "scripts");
  const testFile = join(scriptsDir, "main.test.ts");

  if (!existsSync(testFile)) return true; // 无测试文件视为通过

  const proc = Bun.spawn(["bun", "test"], {
    cwd: scriptsDir,
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  return exitCode === 0;
}

async function main() {
  const args = Bun.argv.slice(2);
  let skillNames: string[];

  if (args.length > 0) {
    skillNames = args;
  } else {
    if (!existsSync(SKILLS_DIR)) {
      console.log("没有找到 skills/ 目录");
      process.exit(0);
    }
    const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
    skillNames = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  }

  if (skillNames.length === 0) {
    console.log("没有找到任何 skill");
    process.exit(0);
  }

  console.log(`\n📋 校验 ${skillNames.length} 个 skill...\n`);

  const results: SkillResult[] = [];

  for (const name of skillNames) {
    const skillDir = join(SKILLS_DIR, name);

    if (!existsSync(skillDir)) {
      results.push({
        name,
        valid: false,
        errors: [`目录不存在: ${skillDir}`],
        warnings: [],
        testsPassed: null,
      });
      continue;
    }

    const validation = await validateSkillDir(skillDir);
    const testsPassed = validation.valid ? await runTests(skillDir) : null;

    results.push({
      name,
      valid: validation.valid && (testsPassed ?? true),
      errors: validation.errors,
      warnings: validation.warnings,
      testsPassed,
    });
  }

  // 输出结果
  for (const r of results) {
    const icon = r.valid ? "✅" : "❌";
    console.log(`${icon} ${r.name}`);

    for (const err of r.errors) {
      console.log(`   错误: ${err}`);
    }
    for (const warn of r.warnings) {
      console.log(`   警告: ${warn}`);
    }
    if (r.testsPassed === false) {
      console.log(`   错误: 测试未通过`);
    }
  }

  const failed = results.filter((r) => !r.valid);
  console.log(
    `\n总计: ${results.length} 个 skill，${results.length - failed.length} 个通过，${failed.length} 个失败\n`,
  );

  if (failed.length > 0) process.exit(1);
}

main();
