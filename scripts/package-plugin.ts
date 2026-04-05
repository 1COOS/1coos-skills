import { existsSync } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  packageSkillAsPlugin,
  updateMarketplaceJson,
} from "@1coos/shared-utils/packager";
import { validateSkillDir } from "@1coos/shared-utils/validator";

const PROJECT_ROOT = join(import.meta.dir, "..");
const SKILLS_DIR = join(PROJECT_ROOT, "skills");
const PLUGINS_DIR = join(PROJECT_ROOT, "plugins");
const MARKETPLACE_PATH = join(
  PROJECT_ROOT,
  ".claude-plugin",
  "marketplace.json",
);

async function main() {
  const args = Bun.argv.slice(2);
  const packageAll = args.includes("--all");
  const skillNames = args.filter((a) => !a.startsWith("--"));

  let toPackage: string[];

  if (packageAll) {
    if (!existsSync(SKILLS_DIR)) {
      console.log("没有找到 skills/ 目录");
      process.exit(0);
    }
    const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
    toPackage = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } else if (skillNames.length > 0) {
    toPackage = skillNames;
  } else {
    console.log("用法: bun run package -- <skill-name> 或 bun run package:all");
    process.exit(1);
  }

  if (toPackage.length === 0) {
    console.log("没有找到任何 skill");
    process.exit(0);
  }

  await mkdir(PLUGINS_DIR, { recursive: true });

  console.log(`\n📦 打包 ${toPackage.length} 个 skill...\n`);

  const pluginEntries: Array<{
    name: string;
    description: string;
    source: string;
  }> = [];
  let hasError = false;

  for (const name of toPackage) {
    const skillDir = join(SKILLS_DIR, name);

    if (!existsSync(skillDir)) {
      console.log(`❌ ${name}: 目录不存在`);
      hasError = true;
      continue;
    }

    // 先校验
    const validation = await validateSkillDir(skillDir);
    if (!validation.valid) {
      console.log(`❌ ${name}: 校验失败`);
      for (const err of validation.errors) {
        console.log(`   ${err}`);
      }
      hasError = true;
      continue;
    }

    // 打包
    const result = await packageSkillAsPlugin({
      skillDir,
      outputDir: PLUGINS_DIR,
    });

    if (!result.success) {
      console.log(`❌ ${name}: ${result.error}`);
      hasError = true;
      continue;
    }

    console.log(`✅ ${name} → plugins/${name}-plugin/`);

    pluginEntries.push({
      name: `${name}-plugin`,
      description: String(result.pluginJson.description || ""),
      source: `./plugins/${name}-plugin`,
    });
  }

  // 更新 marketplace.json
  if (pluginEntries.length > 0) {
    await updateMarketplaceJson(MARKETPLACE_PATH, pluginEntries);
    console.log(`\n📝 marketplace.json 已更新（${pluginEntries.length} 个插件）`);
  }

  console.log(
    `\n总计: ${toPackage.length} 个 skill，${pluginEntries.length} 个成功，${toPackage.length - pluginEntries.length} 个失败\n`,
  );

  if (hasError) process.exit(1);
}

main();
