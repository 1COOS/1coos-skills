# 市场发布指南

## 分发模式

### 模式 A：仓库作为市场源（推荐）

整个仓库作为 Claude 插件市场。用户通过以下方式添加：

```
/plugin marketplace add 1coos/1coos-skills
```

### 模式 B：独立插件仓库

将单个 skill 打包为独立插件，推送到独立 git 仓库。

## 打包流程

### 1. 校验

```bash
bun run validate
```

确保所有 skill 通过校验（SKILL.md 格式、类型检查、测试）。

### 2. 打包

```bash
# 打包单个
bun run package -- <skill-name>

# 打包全部
bun run package:all
```

打包会：
- 校验 SKILL.md
- 在 `plugins/<name>-plugin/` 下创建插件目录结构
- 使用 `Bun.build()` 打包脚本（内联 workspace 依赖）
- 生成 `plugin.json`
- 更新 `marketplace.json`

### 3. 本地测试

```bash
# 将当前仓库添加为市场源
/plugin marketplace add ./

# 安装插件测试
/plugin install <skill-name>-plugin@1coos-skills
```

### 4. 发布

```bash
bun run publish
```

发布脚本会：
1. 运行校验
2. 打包所有 skill
3. 提示输入新版本号
4. 创建 git commit 和 tag
5. 提示推送命令

## 插件目录结构

打包生成的插件结构：

```
plugins/<name>-plugin/
├── .claude-plugin/
│   └── plugin.json         # 插件元数据
└── skills/
    └── <name>/
        ├── SKILL.md        # skill 定义
        ├── scripts/        # 打包后的脚本（自包含）
        ├── references/     # 参考文档
        └── assets/         # 资源文件
```

## 注意事项

- Claude Code 安装插件时会复制到缓存目录，无法解析 workspace 依赖
- 打包步骤使用 `Bun.build()` 将 `@1coos/shared-utils` 等依赖内联
- `plugins/` 目录默认在 `.gitignore` 中，CI/CD 构建后可提交到发布分支
