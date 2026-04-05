# 1coos-skills

Claude Code Skills 开发与发布项目。

## 技术栈

- 运行时：Bun
- 语言：TypeScript (ESM)
- 包管理：Bun workspaces
- 测试：bun:test

## 项目结构

- `packages/shared-utils/` — 共享工具库（校验器、打包器、通用函数）
- `skills/<name>/` — 各个 skill 目录，每个包含 SKILL.md + 可选 scripts/references/assets
- `scripts/` — 项目工具链（脚手架、校验、打包、发布）
- `templates/` — 脚手架模板
- `plugins/` — 构建产物（gitignored）

## 常用命令

```bash
bun run new-skill          # 创建新 skill
bun test                   # 运行所有测试
bun run validate           # 校验所有 skill
bun run package -- <name>  # 打包单个 skill
bun run package:all        # 打包所有 skill
```

## 规范

- SKILL.md 必须包含 YAML frontmatter（name, description, version）
- skill name 使用 kebab-case，最长 64 字符
- description 前置关键用例，不超过 250 字符
- 每个 skill 的 scripts/ 是独立 workspace，可声明自己的依赖
