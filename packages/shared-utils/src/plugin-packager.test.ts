import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  packageForClawHub,
  packageForCodex,
  packageSkillAsPlugin,
  updateMarketplaceJson,
} from "./plugin-packager";

const TEST_DIR = join(import.meta.dir, "../.test-tmp");
const SKILL_DIR = join(TEST_DIR, "test-skill");
const OUTPUT_DIR = join(TEST_DIR, "plugins");

const VALID_SKILL_MD = `---
name: test-skill
description: A test skill
version: 1.0.0
---

# Test Skill

Instructions.`;

beforeEach(async () => {
  await mkdir(join(SKILL_DIR, "scripts"), { recursive: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
});

afterEach(async () => {
  if (existsSync(TEST_DIR)) {
    await rm(TEST_DIR, { recursive: true });
  }
});

describe("packageSkillAsPlugin", () => {
  it("应成功打包包含 SKILL.md 的 skill", async () => {
    await Bun.write(join(SKILL_DIR, "SKILL.md"), VALID_SKILL_MD);

    const result = await packageSkillAsPlugin({
      skillDir: SKILL_DIR,
      outputDir: OUTPUT_DIR,
    });

    expect(result.success).toBe(true);
    expect(
      existsSync(join(result.pluginDir, ".claude-plugin", "plugin.json")),
    ).toBe(true);
    expect(
      existsSync(join(result.pluginDir, "skills", "test-skill", "SKILL.md")),
    ).toBe(true);
  });

  it("缺少 SKILL.md 应失败", async () => {
    const result = await packageSkillAsPlugin({
      skillDir: SKILL_DIR,
      outputDir: OUTPUT_DIR,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("SKILL.md");
  });

  it("应复制 references 和 assets 目录", async () => {
    await Bun.write(join(SKILL_DIR, "SKILL.md"), VALID_SKILL_MD);
    await mkdir(join(SKILL_DIR, "references"), { recursive: true });
    await Bun.write(join(SKILL_DIR, "references", "api.md"), "# API");

    const result = await packageSkillAsPlugin({
      skillDir: SKILL_DIR,
      outputDir: OUTPUT_DIR,
    });

    expect(result.success).toBe(true);
    expect(
      existsSync(
        join(result.pluginDir, "skills", "test-skill", "references", "api.md"),
      ),
    ).toBe(true);
  });
});

describe("packageForClawHub", () => {
  it("应成功打包为 ClawHub 格式", async () => {
    await Bun.write(join(SKILL_DIR, "SKILL.md"), VALID_SKILL_MD);

    const result = await packageForClawHub({
      skillDir: SKILL_DIR,
      outputDir: OUTPUT_DIR,
    });

    expect(result.success).toBe(true);
    expect(existsSync(join(result.pluginDir, "SKILL.md"))).toBe(true);
    // ClawHub 不应有 .claude-plugin 目录
    expect(existsSync(join(result.pluginDir, ".claude-plugin"))).toBe(false);
  });

  it("缺少 SKILL.md 应失败", async () => {
    const result = await packageForClawHub({
      skillDir: SKILL_DIR,
      outputDir: OUTPUT_DIR,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("SKILL.md");
  });

  it("应复制 references 目录", async () => {
    await Bun.write(join(SKILL_DIR, "SKILL.md"), VALID_SKILL_MD);
    await mkdir(join(SKILL_DIR, "references"), { recursive: true });
    await Bun.write(join(SKILL_DIR, "references", "doc.md"), "# Doc");

    const result = await packageForClawHub({
      skillDir: SKILL_DIR,
      outputDir: OUTPUT_DIR,
    });

    expect(result.success).toBe(true);
    expect(
      existsSync(join(result.pluginDir, "references", "doc.md")),
    ).toBe(true);
  });
});

describe("packageForCodex", () => {
  it("应成功打包为 Codex 格式并生成 agents/openai.yaml", async () => {
    await Bun.write(join(SKILL_DIR, "SKILL.md"), VALID_SKILL_MD);

    const result = await packageForCodex({
      skillDir: SKILL_DIR,
      outputDir: OUTPUT_DIR,
    });

    expect(result.success).toBe(true);
    expect(existsSync(join(result.pluginDir, "SKILL.md"))).toBe(true);
    expect(
      existsSync(join(result.pluginDir, "agents", "openai.yaml")),
    ).toBe(true);

    const yamlContent = await Bun.file(
      join(result.pluginDir, "agents", "openai.yaml"),
    ).text();
    expect(yamlContent).toContain("display_name");
    expect(yamlContent).toContain("Test Skill");
    expect(yamlContent).toContain("A test skill");
  });

  it("缺少 SKILL.md 应失败", async () => {
    const result = await packageForCodex({
      skillDir: SKILL_DIR,
      outputDir: OUTPUT_DIR,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("SKILL.md");
  });
});

describe("updateMarketplaceJson", () => {
  it("应创建并更新 marketplace.json", async () => {
    const mpPath = join(TEST_DIR, "marketplace.json");
    await Bun.write(
      mpPath,
      JSON.stringify({ name: "test", owner: { name: "Test" }, plugins: [] }),
    );

    await updateMarketplaceJson(mpPath, [
      {
        name: "skill-a-plugin",
        description: "Skill A",
        source: "./plugins/skill-a-plugin",
      },
    ]);

    const updated = await Bun.file(mpPath).json();
    expect(updated.plugins).toHaveLength(1);
    expect(updated.plugins[0].name).toBe("skill-a-plugin");
  });
});
