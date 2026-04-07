import { existsSync } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  packageForClawHub,
  packageForCodex,
  packageSkillAsPlugin,
  updateMarketplaceJson,
} from "@1coos/shared-utils/packager";
import { validateSkillDir } from "@1coos/shared-utils/validator";

type PackageTarget = "claude" | "openclaw" | "codex" | "all";

const PROJECT_ROOT = join(import.meta.dir, "..");
const SKILLS_DIR = join(PROJECT_ROOT, "skills");
const PLUGINS_DIR = join(PROJECT_ROOT, "plugins");
const DIST_DIR = join(PROJECT_ROOT, "dist");
const MARKETPLACE_PATH = join(
  PROJECT_ROOT,
  ".claude-plugin",
  "marketplace.json",
);

const VALID_TARGETS: PackageTarget[] = ["claude", "openclaw", "codex", "all"];

async function main() {
  const args = Bun.argv.slice(2);
  const packageAll = args.includes("--all");
  const minify = args.includes("--minify");

  // 解析 --target 参数
  let target: PackageTarget = "all";
  const skillNames: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--target" && i + 1 < args.length) {
      const val = args[i + 1] as PackageTarget;
      if (VALID_TARGETS.includes(val)) {
        target = val;
      } else {
        console.error(
          `无效的 target: ${args[i + 1]}（支持: ${VALID_TARGETS.join(", ")}）`,
        );
        process.exit(1);
      }
      i++;
    } else if (!args[i].startsWith("--")) {
      skillNames.push(args[i]);
    }
  }

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
    console.log(
      "用法: bun run package -- <skill-name> [--target claude|openclaw|codex|all] [--minify]",
    );
    console.log("      bun run package:all [--target claude|openclaw|codex|all] [--minify]");
    process.exit(1);
  }

  if (toPackage.length === 0) {
    console.log("没有找到任何 skill");
    process.exit(0);
  }

  const targetLabel = target === "all" ? "全平台" : target;
  console.log(
    `\n📦 打包 ${toPackage.length} 个 skill（目标: ${targetLabel}）...\n`,
  );

  const pluginEntries: Array<{
    name: string;
    description: string;
    source: string;
  }> = [];
  let hasError = false;
  let successCount = 0;

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

    let skillSuccess = true;

    // Claude Code 格式
    if (target === "claude" || target === "all") {
      await mkdir(PLUGINS_DIR, { recursive: true });
      const result = await packageSkillAsPlugin({
        skillDir,
        outputDir: PLUGINS_DIR,
        minify,
      });

      if (!result.success) {
        console.log(`❌ ${name} [claude]: ${result.error}`);
        skillSuccess = false;
      } else {
        console.log(`✅ ${name} → plugins/${name}-plugin/`);
        pluginEntries.push({
          name: `${name}-plugin`,
          description: String(result.pluginJson.description || ""),
          source: `./plugins/${name}-plugin`,
        });
      }
    }

    // ClawHub/OpenClaw 格式
    if (target === "openclaw" || target === "all") {
      const clawHubDir = join(DIST_DIR, "clawhub");
      await mkdir(clawHubDir, { recursive: true });
      const result = await packageForClawHub({
        skillDir,
        outputDir: clawHubDir,
        minify,
      });

      if (!result.success) {
        console.log(`❌ ${name} [openclaw]: ${result.error}`);
        skillSuccess = false;
      } else {
        console.log(`✅ ${name} → dist/clawhub/${name}/`);
      }
    }

    // Codex 格式
    if (target === "codex" || target === "all") {
      const codexDir = join(DIST_DIR, "codex");
      await mkdir(codexDir, { recursive: true });
      const result = await packageForCodex({
        skillDir,
        outputDir: codexDir,
        minify,
      });

      if (!result.success) {
        console.log(`❌ ${name} [codex]: ${result.error}`);
        skillSuccess = false;
      } else {
        console.log(`✅ ${name} → dist/codex/${name}/`);
      }
    }

    if (skillSuccess) {
      successCount++;
    } else {
      hasError = true;
    }
  }

  // 更新 Claude Code marketplace.json
  if (pluginEntries.length > 0) {
    await updateMarketplaceJson(MARKETPLACE_PATH, pluginEntries);
    console.log(
      `\n📝 marketplace.json 已更新（${pluginEntries.length} 个插件）`,
    );
  }

  const failCount = toPackage.length - successCount;
  console.log(
    `\n总计: ${toPackage.length} 个 skill，${successCount} 个成功，${failCount} 个失败\n`,
  );

  if (hasError) process.exit(1);
}

main();
