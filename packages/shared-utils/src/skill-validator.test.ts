import { describe, expect, it } from "bun:test";
import { validateSkillMd } from "./skill-validator";

describe("validateSkillMd", () => {
  it("有效的 SKILL.md 应通过校验", () => {
    const content = `---
name: my-skill
description: A useful skill for doing things
version: 1.0.0
---

# My Skill

Instructions here.`;

    const result = validateSkillMd(content);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("缺少 frontmatter 应报错", () => {
    const result = validateSkillMd("no frontmatter");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("YAML frontmatter");
  });

  it("非 kebab-case name 应报错", () => {
    const content = `---
name: MySkill
description: test
---

body`;

    const result = validateSkillMd(content);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("kebab-case");
  });

  it("name 超长应报错", () => {
    const longName = "a-" + "b".repeat(64);
    const content = `---
name: ${longName}
description: test
---

body`;

    const result = validateSkillMd(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("64"))).toBe(true);
  });

  it("缺少 description 应给警告", () => {
    const content = `---
name: my-skill
version: 1.0.0
---

body`;

    const result = validateSkillMd(content);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("description"))).toBe(true);
  });

  it("description 超长应给警告", () => {
    const longDesc = "a".repeat(260);
    const content = `---
name: my-skill
description: ${longDesc}
---

body`;

    const result = validateSkillMd(content);
    expect(result.warnings.some((w) => w.includes("250"))).toBe(true);
  });

  it("无效 version 格式应报错", () => {
    const content = `---
name: my-skill
version: abc
---

body`;

    const result = validateSkillMd(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("语义化版本"))).toBe(true);
  });

  it("无效 effort 应报错", () => {
    const content = `---
name: my-skill
effort: ultra
---

body`;

    const result = validateSkillMd(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("effort"))).toBe(true);
  });

  it("无效 context 应报错", () => {
    const content = `---
name: my-skill
context: isolate
---

body`;

    const result = validateSkillMd(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("fork"))).toBe(true);
  });

  it("空 body 应给警告", () => {
    const content = `---
name: my-skill
---

`;

    const result = validateSkillMd(content);
    expect(result.warnings.some((w) => w.includes("body"))).toBe(true);
  });
});
