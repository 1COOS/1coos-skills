import { join } from "node:path";
import { createInterface } from "node:readline";

const PROJECT_ROOT = join(import.meta.dir, "..");

function prompt(question: string, defaultValue = ""): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    const suffix = defaultValue ? ` (${defaultValue})` : "";
    rl.question(`${question}${suffix}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function run(
  cmd: string[],
  cwd = PROJECT_ROOT,
): Promise<{ ok: boolean; output: string }> {
  const proc = Bun.spawn(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  return { ok: exitCode === 0, output: stdout + stderr };
}

async function main() {
  console.log("\n🚀 发布 1coos-skills\n");

  // 1. 运行校验
  console.log("步骤 1/4: 校验所有 skill...");
  const validateResult = await run(["bun", "run", "validate"]);
  if (!validateResult.ok) {
    console.error("校验失败，请先修复错误:\n" + validateResult.output);
    process.exit(1);
  }
  console.log("✅ 校验通过\n");

  // 2. 打包
  console.log("步骤 2/4: 打包所有 skill...");
  const packageResult = await run(["bun", "run", "package:all"]);
  if (!packageResult.ok) {
    console.error("打包失败:\n" + packageResult.output);
    process.exit(1);
  }
  console.log("✅ 打包完成\n");

  // 3. 版本号
  const pkgPath = join(PROJECT_ROOT, "package.json");
  const pkg = await Bun.file(pkgPath).json();
  const currentVersion = pkg.version;

  const newVersion = await prompt(
    `当前版本 ${currentVersion}，输入新版本号`,
    currentVersion,
  );
  if (newVersion !== currentVersion) {
    pkg.version = newVersion;
    await Bun.write(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    console.log(`版本更新为 ${newVersion}\n`);
  }

  // 4. Git 操作
  console.log("步骤 3/4: Git 提交...");
  const statusResult = await run(["git", "status", "--porcelain"]);
  if (statusResult.output.trim()) {
    await run(["git", "add", "-A"]);
    await run([
      "git",
      "commit",
      "-m",
      `release: v${newVersion}`,
    ]);
    console.log("✅ 已提交\n");
  } else {
    console.log("无变更需要提交\n");
  }

  // 创建 tag
  console.log("步骤 4/4: 创建标签...");
  const tagResult = await run(["git", "tag", `v${newVersion}`]);
  if (tagResult.ok) {
    console.log(`✅ 标签 v${newVersion} 已创建\n`);
  } else {
    console.log(`标签可能已存在: ${tagResult.output}\n`);
  }

  console.log("发布准备完成！执行以下命令推送:");
  console.log(`  git push origin main --tags\n`);
}

main();
