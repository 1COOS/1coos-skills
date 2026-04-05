import { existsSync } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseFrontmatter } from "@1coos/shared-utils";
import { packageForClawHub } from "@1coos/shared-utils/packager";
import { validateSkillDir } from "@1coos/shared-utils/validator";
import type { SkillFrontmatter } from "@1coos/shared-utils/validator";

const PROJECT_ROOT = join(import.meta.dir, "..");
const SKILLS_DIR = join(PROJECT_ROOT, "skills");
const DIST_DIR = join(PROJECT_ROOT, "dist");
const CLAWHUB_DIST_DIR = join(DIST_DIR, "clawhub");

// ── 工具函数 ──────────────────────────────────────────

async function run(
  cmd: string[],
  cwd = PROJECT_ROOT,
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const proc = Bun.spawn(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  return { ok: exitCode === 0, stdout, stderr };
}

async function checkClawHubCli(): Promise<boolean> {
  const result = await run(["clawhub", "-V"]);
  if (result.ok) {
    console.log(`  clawhub CLI: ${result.stdout.trim()}`);
    return true;
  }
  return false;
}

async function checkClawHubAuth(): Promise<boolean> {
  const result = await run(["clawhub", "whoami"]);
  if (!result.ok) {
    const combined = result.stdout + result.stderr;
    if (
      combined.includes("not logged in") ||
      combined.includes("auth") ||
      combined.includes("login")
    ) {
      return false;
    }
    // 未知错误 — 假定已认证，发布时再验证
    console.log("  警告: 无法确认认证状态，将在发布时验证");
    return true;
  }
  console.log(`  已认证: ${result.stdout.trim()}`);
  return true;
}

// ── 元数据读取 ────────────────────────────────────────

interface SkillMetadata {
  name: string;
  version: string;
  description: string;
  slug: string;
}

async function readSkillMetadata(
  skillName: string,
): Promise<SkillMetadata | null> {
  const skillMdPath = join(SKILLS_DIR, skillName, "SKILL.md");
  const file = Bun.file(skillMdPath);
  if (!(await file.exists())) return null;

  const content = await file.text();
  const parsed = parseFrontmatter(content);
  if (!parsed) return null;

  const fm = parsed.frontmatter as SkillFrontmatter;
  return {
    name: String(fm.name || skillName),
    version: String(fm.version || "1.0.0"),
    description: String(fm.description || ""),
    slug: String(fm.name || skillName),
  };
}

// ── 单个 skill 发布 ──────────────────────────────────

interface PublishOptions {
  skillName: string;
  dryRun: boolean;
  versionOverride?: string;
  changelog?: string;
  skipValidate: boolean;
  skipPackage: boolean;
}

interface PublishResult {
  skillName: string;
  success: boolean;
  message: string;
  version?: string;
}

async function publishOneSkill(
  options: PublishOptions,
): Promise<PublishResult> {
  const {
    skillName,
    dryRun,
    versionOverride,
    changelog,
    skipValidate,
    skipPackage,
  } = options;
  const skillDir = join(SKILLS_DIR, skillName);

  if (!existsSync(skillDir)) {
    return { skillName, success: false, message: `目录不存在: ${skillDir}` };
  }

  // 1. 校验
  if (!skipValidate) {
    console.log(`  校验 ${skillName}...`);
    const validation = await validateSkillDir(skillDir, "openclaw");
    if (!validation.valid) {
      const errMsg = validation.errors.join("; ");
      return { skillName, success: false, message: `校验失败: ${errMsg}` };
    }
    if (validation.warnings.length > 0) {
      for (const w of validation.warnings) {
        console.log(`    警告: ${w}`);
      }
    }
  }

  // 2. 读取元数据
  const metadata = await readSkillMetadata(skillName);
  if (!metadata) {
    return {
      skillName,
      success: false,
      message: "无法读取 SKILL.md frontmatter",
    };
  }

  const version = versionOverride || metadata.version;

  // 3. 打包
  if (!skipPackage) {
    console.log(`  打包 ${skillName} (openclaw)...`);
    await mkdir(CLAWHUB_DIST_DIR, { recursive: true });
    const packageResult = await packageForClawHub({
      skillDir,
      outputDir: CLAWHUB_DIST_DIR,
    });
    if (!packageResult.success) {
      return {
        skillName,
        success: false,
        message: `打包失败: ${packageResult.error}`,
      };
    }
  }

  // 4. 检查打包产物
  const distPath = join(CLAWHUB_DIST_DIR, skillName);
  if (!existsSync(distPath)) {
    return {
      skillName,
      success: false,
      message: `打包产物不存在: ${distPath}`,
    };
  }

  // 5. 构建发布命令
  const cmd: string[] = [
    "clawhub",
    "publish",
    distPath,
    "--slug",
    metadata.slug,
    "--name",
    metadata.name,
    "--version",
    version,
  ];

  if (changelog) {
    cmd.push("--changelog", changelog);
  }

  // 6. 执行发布
  const action = dryRun ? "预览发布" : "发布";
  console.log(`  ${action} ${skillName}@${version}...`);

  if (dryRun) {
    console.log(`  [dry-run] 将执行: ${cmd.join(" ")}`);
    return { skillName, success: true, message: `${action}成功（未实际发布）`, version };
  }

  const result = await run(cmd);
  if (!result.ok) {
    const errorOutput = (result.stderr || result.stdout).trim();
    return {
      skillName,
      success: false,
      message: `${action}失败: ${errorOutput}`,
      version,
    };
  }

  if (result.stdout.trim()) {
    console.log(`  ${result.stdout.trim()}`);
  }

  // 7. 验证（仅非 dry-run）
  if (!dryRun) {
    console.log(`  验证 ${skillName}...`);
    const inspectResult = await run([
      "clawhub",
      "inspect",
      metadata.slug,
    ]);
    if (inspectResult.ok) {
      console.log(`  验证通过`);
    } else {
      console.log(
        `  发布成功但验证失败，请手动检查: clawhub inspect ${metadata.slug}`,
      );
    }
  }

  return { skillName, success: true, message: `${action}成功`, version };
}

// ── CLI 参数解析 ─────────────────────────────────────

interface CliArgs {
  skillNames: string[];
  all: boolean;
  dryRun: boolean;
  versionOverride?: string;
  changelog?: string;
  skipValidate: boolean;
  skipPackage: boolean;
}

function parseArgs(): CliArgs {
  const args = Bun.argv.slice(2);
  const result: CliArgs = {
    skillNames: [],
    all: false,
    dryRun: false,
    skipValidate: false,
    skipPackage: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--all":
        result.all = true;
        break;
      case "--dry-run":
        result.dryRun = true;
        break;
      case "--version":
        result.versionOverride = args[++i];
        break;
      case "--changelog":
        result.changelog = args[++i];
        break;
      case "--skip-validate":
        result.skipValidate = true;
        break;
      case "--skip-package":
        result.skipPackage = true;
        break;
      default:
        if (!args[i].startsWith("--")) {
          result.skillNames.push(args[i]);
        } else {
          console.error(`未知参数: ${args[i]}`);
          process.exit(1);
        }
    }
  }

  return result;
}

// ── 主流程 ───────────────────────────────────────────

async function main() {
  console.log("\n🚀 发布 skill 到 ClawHub\n");

  const args = parseArgs();

  // 用法提示
  if (!args.all && args.skillNames.length === 0) {
    console.log("用法: bun run publish:clawhub -- <skill-name> [options]");
    console.log("      bun run publish:clawhub -- --all [options]");
    console.log("\n选项:");
    console.log("  --all              发布所有 skill");
    console.log("  --dry-run          预览模式，不实际发布");
    console.log("  --version <ver>    覆盖版本号");
    console.log('  --changelog <msg>  变更说明');
    console.log("  --skip-validate    跳过校验");
    console.log("  --skip-package     跳过打包（使用现有产物）");
    process.exit(1);
  }

  // 步骤 1: 环境检查
  console.log("步骤 1/3: 环境检查...");
  const cliReady = await checkClawHubCli();
  if (!cliReady) {
    console.error("❌ clawhub CLI 未安装。请先安装:");
    console.error("   npm install -g clawhub");
    console.error("   或使用 npx clawhub@latest");
    process.exit(1);
  }

  if (!args.dryRun) {
    const authed = await checkClawHubAuth();
    if (!authed) {
      console.error("❌ 未登录 ClawHub。请先执行:");
      console.error("   clawhub login");
      process.exit(1);
    }
  }
  console.log("✅ 环境检查通过\n");

  // 步骤 2: 确定发布列表
  console.log("步骤 2/3: 确定发布列表...");
  let toPublish: string[];

  if (args.all) {
    if (!existsSync(SKILLS_DIR)) {
      console.log("没有找到 skills/ 目录");
      process.exit(0);
    }
    const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
    toPublish = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } else {
    toPublish = args.skillNames;
  }

  if (toPublish.length === 0) {
    console.log("没有找到任何 skill");
    process.exit(0);
  }

  const mode = args.dryRun ? "预览" : "发布";
  console.log(`将${mode} ${toPublish.length} 个 skill: ${toPublish.join(", ")}\n`);

  // 步骤 3: 逐个发布
  console.log(`步骤 3/3: ${mode}...\n`);
  const results: PublishResult[] = [];

  for (const skillName of toPublish) {
    console.log(`── ${skillName} ──`);
    const result = await publishOneSkill({
      skillName,
      dryRun: args.dryRun,
      versionOverride: args.versionOverride,
      changelog: args.changelog,
      skipValidate: args.skipValidate,
      skipPackage: args.skipPackage,
    });
    results.push(result);

    const icon = result.success ? "✅" : "❌";
    const verStr = result.version ? `@${result.version}` : "";
    console.log(`${icon} ${skillName}${verStr}: ${result.message}\n`);
  }

  // 汇总
  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log("────────────────────────────────");
  console.log(
    `${mode}完成: ${toPublish.length} 个 skill，${succeeded.length} 个成功，${failed.length} 个失败`,
  );

  if (failed.length > 0) {
    console.log("\n失败列表:");
    for (const f of failed) {
      console.log(`  ❌ ${f.skillName}: ${f.message}`);
    }
    process.exit(1);
  }

  console.log("");
}

main();
