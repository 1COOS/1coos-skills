import { existsSync } from "node:fs";
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { parseFrontmatter } from "./index";
import type { SkillFrontmatter } from "./skill-validator";

export interface PackageOptions {
  skillDir: string;
  outputDir: string;
  minify?: boolean;
}

export interface PackageResult {
  success: boolean;
  pluginDir: string;
  pluginJson: Record<string, unknown>;
  error?: string;
}

/**
 * 将 skill 目录打包为插件格式
 */
export async function packageSkillAsPlugin(
  options: PackageOptions,
): Promise<PackageResult> {
  const { skillDir, outputDir } = options;
  const skillName = basename(skillDir);
  const pluginName = `${skillName}-plugin`;
  const pluginDir = join(outputDir, pluginName);

  try {
    // 读取 SKILL.md
    const skillMdPath = join(skillDir, "SKILL.md");
    const skillMdFile = Bun.file(skillMdPath);
    if (!(await skillMdFile.exists())) {
      return {
        success: false,
        pluginDir,
        pluginJson: {},
        error: `SKILL.md 不存在: ${skillMdPath}`,
      };
    }

    const content = await skillMdFile.text();
    const parsed = parseFrontmatter(content);
    if (!parsed) {
      return {
        success: false,
        pluginDir,
        pluginJson: {},
        error: "SKILL.md 缺少 YAML frontmatter",
      };
    }

    const fm = parsed.frontmatter as SkillFrontmatter;

    // 清理旧的输出
    if (existsSync(pluginDir)) {
      await rm(pluginDir, { recursive: true });
    }

    // 创建插件目录结构
    const pluginSkillDir = join(pluginDir, "skills", skillName);
    await mkdir(join(pluginDir, ".claude-plugin"), { recursive: true });
    await mkdir(pluginSkillDir, { recursive: true });

    // 生成 plugin.json
    const pluginJson = {
      name: pluginName,
      version: String(fm.version || "1.0.0"),
      description: String(fm.description || ""),
      author: { name: String(fm.author || "1COOS") },
      keywords: ["1coos", skillName],
    };

    await Bun.write(
      join(pluginDir, ".claude-plugin", "plugin.json"),
      JSON.stringify(pluginJson, null, 2) + "\n",
    );

    // 复制 SKILL.md
    await cp(skillMdPath, join(pluginSkillDir, "SKILL.md"));

    // 复制 references/ 和 assets/（如果存在）
    for (const subdir of ["references", "assets"]) {
      const srcDir = join(skillDir, subdir);
      if (existsSync(srcDir)) {
        await cp(srcDir, join(pluginSkillDir, subdir), { recursive: true });
      }
    }

    // 处理 scripts/
    const scriptsDir = join(skillDir, "scripts");
    if (existsSync(scriptsDir)) {
      const destScriptsDir = join(pluginSkillDir, "scripts");
      await mkdir(destScriptsDir, { recursive: true });

      const mainTsPath = join(scriptsDir, "main.ts");
      if (existsSync(mainTsPath)) {
        // 使用 Bun.build() 打包，内联 workspace 依赖
        const buildResult = await Bun.build({
          entrypoints: [mainTsPath],
          outdir: destScriptsDir,
          target: "bun",
          format: "esm",
          minify: options.minify ?? false,
        });

        if (!buildResult.success) {
          const errors = buildResult.logs
            .map((l) => l.message)
            .join("; ");
          return {
            success: false,
            pluginDir,
            pluginJson,
            error: `脚本打包失败: ${errors}`,
          };
        }
      }

      // 复制非 .ts 文件（配置文件等）
      const files = await readdir(scriptsDir);
      for (const file of files) {
        if (
          !file.endsWith(".ts") &&
          file !== "node_modules" &&
          file !== "package.json" &&
          file !== "bun.lock"
        ) {
          const srcPath = join(scriptsDir, file);
          const destPath = join(destScriptsDir, file);
          await cp(srcPath, destPath, { recursive: true });
        }
      }
    }

    return { success: true, pluginDir, pluginJson };
  } catch (err) {
    return {
      success: false,
      pluginDir,
      pluginJson: {},
      error: String(err),
    };
  }
}

/**
 * 打包脚本并复制静态资源到目标目录
 */
async function buildScriptsAndAssets(
  skillDir: string,
  destSkillDir: string,
  minify = false,
): Promise<{ success: boolean; error?: string }> {
  // 复制 SKILL.md
  await cp(join(skillDir, "SKILL.md"), join(destSkillDir, "SKILL.md"));

  // 复制 references/ 和 assets/
  for (const subdir of ["references", "assets"]) {
    const srcDir = join(skillDir, subdir);
    if (existsSync(srcDir)) {
      await cp(srcDir, join(destSkillDir, subdir), { recursive: true });
    }
  }

  // 处理 scripts/
  const scriptsDir = join(skillDir, "scripts");
  if (existsSync(scriptsDir)) {
    const destScriptsDir = join(destSkillDir, "scripts");
    await mkdir(destScriptsDir, { recursive: true });

    const mainTsPath = join(scriptsDir, "main.ts");
    if (existsSync(mainTsPath)) {
      const buildResult = await Bun.build({
        entrypoints: [mainTsPath],
        outdir: destScriptsDir,
        target: "bun",
        format: "esm",
        minify,
      });

      if (!buildResult.success) {
        const errors = buildResult.logs.map((l) => l.message).join("; ");
        return { success: false, error: `脚本打包失败: ${errors}` };
      }
    }

    // 复制非 .ts 文件（配置文件等）
    const files = await readdir(scriptsDir);
    for (const file of files) {
      if (
        !file.endsWith(".ts") &&
        file !== "node_modules" &&
        file !== "package.json" &&
        file !== "bun.lock"
      ) {
        await cp(join(scriptsDir, file), join(destScriptsDir, file), {
          recursive: true,
        });
      }
    }
  }

  return { success: true };
}

/**
 * 将 skill 打包为 ClawHub 格式（OpenClaw 兼容）
 */
export async function packageForClawHub(
  options: PackageOptions,
): Promise<PackageResult> {
  const { skillDir, outputDir } = options;
  const skillName = basename(skillDir);
  const pluginDir = join(outputDir, skillName);

  try {
    const skillMdFile = Bun.file(join(skillDir, "SKILL.md"));
    if (!(await skillMdFile.exists())) {
      return {
        success: false,
        pluginDir,
        pluginJson: {},
        error: `SKILL.md 不存在: ${join(skillDir, "SKILL.md")}`,
      };
    }

    const content = await skillMdFile.text();
    const parsed = parseFrontmatter(content);
    if (!parsed) {
      return {
        success: false,
        pluginDir,
        pluginJson: {},
        error: "SKILL.md 缺少 YAML frontmatter",
      };
    }

    // 清理旧的输出
    if (existsSync(pluginDir)) {
      await rm(pluginDir, { recursive: true });
    }
    await mkdir(pluginDir, { recursive: true });

    const buildResult = await buildScriptsAndAssets(skillDir, pluginDir, options.minify);
    if (!buildResult.success) {
      return {
        success: false,
        pluginDir,
        pluginJson: {},
        error: buildResult.error,
      };
    }

    const fm = parsed.frontmatter as SkillFrontmatter;
    return {
      success: true,
      pluginDir,
      pluginJson: {
        name: skillName,
        description: String(fm.description || ""),
        version: String(fm.version || "1.0.0"),
      },
    };
  } catch (err) {
    return { success: false, pluginDir, pluginJson: {}, error: String(err) };
  }
}

/**
 * 将 skill 打包为 Codex 格式（自动生成 agents/openai.yaml）
 */
export async function packageForCodex(
  options: PackageOptions,
): Promise<PackageResult> {
  const { skillDir, outputDir } = options;
  const skillName = basename(skillDir);
  const pluginDir = join(outputDir, skillName);

  try {
    const skillMdFile = Bun.file(join(skillDir, "SKILL.md"));
    if (!(await skillMdFile.exists())) {
      return {
        success: false,
        pluginDir,
        pluginJson: {},
        error: `SKILL.md 不存在: ${join(skillDir, "SKILL.md")}`,
      };
    }

    const content = await skillMdFile.text();
    const parsed = parseFrontmatter(content);
    if (!parsed) {
      return {
        success: false,
        pluginDir,
        pluginJson: {},
        error: "SKILL.md 缺少 YAML frontmatter",
      };
    }

    // 清理旧的输出
    if (existsSync(pluginDir)) {
      await rm(pluginDir, { recursive: true });
    }
    await mkdir(pluginDir, { recursive: true });

    const buildResult = await buildScriptsAndAssets(skillDir, pluginDir, options.minify);
    if (!buildResult.success) {
      return {
        success: false,
        pluginDir,
        pluginJson: {},
        error: buildResult.error,
      };
    }

    // 生成 agents/openai.yaml
    const fm = parsed.frontmatter as SkillFrontmatter;
    const displayName = skillName
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    const agentsConfig = {
      interface: {
        display_name: displayName,
        short_description: String(fm.description || ""),
      },
    };

    const agentsDir = join(pluginDir, "agents");
    await mkdir(agentsDir, { recursive: true });
    await Bun.write(
      join(agentsDir, "openai.yaml"),
      stringifyYaml(agentsConfig),
    );

    return {
      success: true,
      pluginDir,
      pluginJson: {
        name: skillName,
        description: String(fm.description || ""),
        version: String(fm.version || "1.0.0"),
      },
    };
  } catch (err) {
    return { success: false, pluginDir, pluginJson: {}, error: String(err) };
  }
}

/**
 * 更新 marketplace.json 的 plugins 列表
 */
export async function updateMarketplaceJson(
  marketplacePath: string,
  pluginEntries: Array<{ name: string; description: string; source: string }>,
): Promise<void> {
  const file = Bun.file(marketplacePath);
  let marketplace: Record<string, unknown> = {};

  if (await file.exists()) {
    marketplace = await file.json();
  }

  marketplace.plugins = pluginEntries.map((entry) => ({
    name: entry.name,
    description: entry.description,
    source: entry.source,
  }));

  await Bun.write(marketplacePath, JSON.stringify(marketplace, null, 2) + "\n");
}
