# 1coos-skills

1COOS Claude Code Skills 开发与发布项目。

## 简介

本项目是一个 Bun monorepo，用于开发、测试和发布 Claude Code skills。每个 skill 严格遵循 [Claude skill 规范](https://code.claude.com/docs/en/skills)，支持打包为插件并上传到 Claude 插件市场。

## 快速开始

```bash
# 安装依赖
bun install

# 创建新 skill
bun run new-skill

# 运行测试
bun test

# 校验所有 skill
bun run validate

# 打包
bun run package:all
```

## 项目结构

```
skills/          — 各个 skill 源码
packages/        — 共享工具库
scripts/         — 项目工具链
templates/       — 脚手架模板
plugins/         — 构建产物（自动生成）
docs/            — 项目文档
```

## 文档

- [Skill 开发指南](docs/creating-skills.md)
- [市场发布指南](docs/publishing.md)
- [Claude Skill 规范参考](docs/skill-spec.md)

## 许可

MIT
