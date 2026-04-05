# Claude Skill 规范参考

本文档整理自 [Claude Code 官方文档](https://code.claude.com/docs/en/skills)。

## SKILL.md 文件格式

```yaml
---
name: skill-name
description: 触发条件描述
version: 1.0.0
argument-hint: <required> [optional]
allowed-tools: [Read, Glob, Grep]
model: sonnet
disable-model-invocation: false
user-invocable: true
effort: medium
context: fork
agent: Explore
paths: ["src/**/*.ts"]
---

Markdown 格式的指令内容...
```

## 字段说明

### name
- 类型：字符串
- 格式：小写字母、数字、连字符（kebab-case）
- 限制：最长 64 字符
- 默认：目录名
- 用途：`/` 命令名和显示标识

### description
- 类型：字符串
- 限制：市场列表截断 250 字符
- 用途：Claude 根据此字段决定何时自动触发 skill
- 建议：使用第三人称，前置关键用例，包含具体触发短语

### version
- 类型：字符串
- 格式：语义化版本（如 `1.0.0`）
- 用途：市场更新检查

### argument-hint
- 类型：字符串
- 示例：`<file> [--format json]`
- 用途：自动补全时显示参数提示

### allowed-tools
- 类型：字符串列表
- 可选值：`Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`, `Agent`, `WebFetch`, `WebSearch`, `NotebookEdit`
- 支持参数：如 `Bash(bun test*)`
- 用途：skill 激活时预授权的工具

### model
- 类型：字符串
- 可选值：`haiku`, `sonnet`, `opus`
- 用途：覆盖默认模型

### disable-model-invocation
- 类型：布尔值
- 默认：`false`
- 用途：`true` 时仅可通过 `/` 手动触发，不会自动激活

### user-invocable
- 类型：布尔值
- 默认：`true`
- 用途：`false` 时从 `/` 菜单隐藏，仅作为背景知识

### effort
- 类型：字符串
- 可选值：`low`, `medium`, `high`, `max`
- 用途：推理力度覆盖

### context
- 类型：字符串
- 可选值：`fork`
- 用途：在隔离子代理上下文中运行

### agent
- 类型：字符串
- 可选值：`Explore`, `Plan`, `general-purpose` 或自定义代理名
- 条件：需要 `context: fork`
- 用途：指定子代理类型

### paths
- 类型：字符串列表（glob 模式）
- 示例：`["src/frontend/**"]`
- 用途：限制 skill 仅在匹配路径的文件操作时激活

## Skill 类型

### 模型触发型
- 无 `argument-hint`
- Claude 根据 description 自动判断是否触发
- 适用场景：编码规范、自动化建议

### 用户触发型（斜杠命令）
- 有 `argument-hint` 和 `allowed-tools`
- 用户通过 `/skill-name` 手动调用
- 可使用 `$ARGUMENTS` 变量获取参数

## 变量替换

| 变量 | 说明 |
|------|------|
| `$ARGUMENTS` | 所有传入参数 |
| `$ARGUMENTS[N]` / `$N` | 第 N 个参数（0 索引） |
| `${CLAUDE_SESSION_ID}` | 当前会话 ID |
| `${CLAUDE_SKILL_DIR}` | SKILL.md 所在目录 |

## 三级加载机制

1. **元数据**（~100 tokens）：name + description，始终在上下文中
2. **SKILL.md body**（建议 <500 行 / <5000 词）：触发时加载
3. **捆绑资源**（scripts/, references/, assets/）：按需加载

## 最佳实践

- SKILL.md 控制在 500 行以内
- 长参考文档放在 references/ 中，超过 300 行的加目录
- 指令使用祈使句
- 解释原因而非强制要求（"because..." 优于 "MUST"）
- description 略微"积极"以对抗 undertriggering
