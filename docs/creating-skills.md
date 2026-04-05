# Skill 开发指南

## 创建新 Skill

```bash
bun run new-skill
```

按照提示输入 skill 名称、描述和作者即可自动生成骨架代码。

## 目录结构

每个 skill 目录包含：

```
skills/<skill-name>/
├── SKILL.md              # 必需：skill 定义文件
├── scripts/              # 可选：可执行脚本
│   ├── package.json      # workspace 包配置
│   ├── main.ts           # 入口文件
│   └── main.test.ts      # 测试文件
├── references/           # 可选：参考文档（按需加载到上下文）
└── assets/               # 可选：模板、图标等资源文件
```

## SKILL.md 格式

SKILL.md 使用 YAML frontmatter + Markdown body：

```yaml
---
name: my-skill
description: 当用户需要做某件事时使用此 skill
version: 1.0.0
---

# My Skill

在此编写 skill 的详细使用说明...
```

### 必需字段

| 字段 | 要求 | 说明 |
|------|------|------|
| `name` | kebab-case，最长 64 字符 | skill 标识符，也是 `/` 命令名 |
| `description` | 建议不超过 250 字符 | 触发条件描述，前置关键用例 |
| `version` | 语义化版本 | 如 `1.0.0` |

### 可选字段

| 字段 | 说明 |
|------|------|
| `argument-hint` | 自动补全提示，如 `<file> [options]` |
| `allowed-tools` | 预授权工具列表，如 `[Read, Glob, Grep, Bash]` |
| `model` | 模型覆盖：`haiku`、`sonnet`、`opus` |
| `disable-model-invocation` | `true` 禁止自动触发，仅手动调用 |
| `user-invocable` | `false` 从 `/` 菜单隐藏 |
| `effort` | 推理力度：`low`、`medium`、`high`、`max` |
| `context` | 设为 `fork` 在隔离子代理中运行 |
| `agent` | 子代理类型：`Explore`、`Plan`、`general-purpose` |
| `paths` | glob 模式，限制 skill 激活范围 |

## 编写 description 的最佳实践

- 使用第三人称："This skill should be used when..."
- 包含具体的触发短语
- 前置最关键的用例
- 适当"积极"以对抗 Claude 的 undertriggering 倾向

## 脚本开发

脚本在 `scripts/` 目录中开发，使用 Bun 运行。每个 skill 的 scripts/ 是独立的 workspace 成员，可以声明自己的依赖。

### 使用共享工具

```typescript
import { generateId, truncate } from "@1coos/shared-utils";
```

### 运行测试

```bash
# 单个 skill
cd skills/<name>/scripts && bun test

# 所有 skill
bun test
```

### 校验

```bash
bun run validate              # 校验所有
bun run validate -- <name>    # 校验单个
```

## 渐进式加载

Claude 按三个层级加载 skill 内容：

1. **元数据**（~100 tokens）：name + description，始终在上下文中
2. **SKILL.md body**（建议 <500 行）：skill 触发时加载
3. **捆绑资源**（references/ 和 scripts/）：按需加载

保持 SKILL.md 精简，将详细内容放在 references/ 中。
