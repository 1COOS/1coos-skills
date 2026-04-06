/**
 * 在 .claude/skills/ 中为所有 skill 创建软链接，方便本地调试。
 *
 * 用法: bun run link-skills
 */

import { readdir, symlink, readlink, unlink, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const PROJECT_ROOT = resolve(import.meta.dir, "..");
const SKILLS_DIR = join(PROJECT_ROOT, "skills");
const CLAUDE_SKILLS_DIR = join(PROJECT_ROOT, ".claude", "skills");

async function main() {
  // 确保 .claude/skills/ 目录存在
  await mkdir(CLAUDE_SKILLS_DIR, { recursive: true });

  // 读取 skills/ 下的所有目录
  const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
  const skillDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  if (skillDirs.length === 0) {
    console.log("没有找到任何 skill 目录");
    return;
  }

  let created = 0;
  let skipped = 0;
  let updated = 0;

  for (const name of skillDirs) {
    const target = join(SKILLS_DIR, name);
    const link = join(CLAUDE_SKILLS_DIR, name);

    try {
      const existing = await readlink(link);
      if (existing === target) {
        console.log(`  ✓ ${name} (已存在)`);
        skipped++;
        continue;
      }
      // 链接指向错误目标，删除后重建
      await unlink(link);
      await symlink(target, link);
      console.log(`  ↻ ${name} (已更新)`);
      updated++;
    } catch {
      // 不存在，创建新链接
      await symlink(target, link);
      console.log(`  + ${name} (已创建)`);
      created++;
    }
  }

  console.log(
    `\n完成: ${created} 新建, ${updated} 更新, ${skipped} 已存在`,
  );
}

main();
