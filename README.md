# Workspore CLI

把调校好的 AI 工作区固化为带版本的模板，从模板落出新工作区。工具只有两个动作，初始化之后退场：**工具管字节（固化、落地），agent 管语义（整理、合并、引导）**。

产品定义见 `Workspore产品定义.md`，术语表见 `CONTEXT.md`，决策见 `docs/adr/`，规格见 `.scratch/workspore-cli/spec.md`。

## 安装与运行

零依赖，Node ≥ 20：

```
node bin/workspore.js --help
```

## save——固化

在工作区内运行：

```
workspore save [--to <目录>] [--minor | --major] [-m <说明>]
```

- **自动收上下文**：指令文件原样，有哪个存哪个（ADR-0002）——`AGENTS.md`、`CLAUDE.md`、`GEMINI.md`、`.cursorrules`、`.windsurfrules`、`.github/copilot-instructions.md`、`.cursor/rules/**`。
- **自动收能力**：skills 与命令（`.claude`、`.agents`、`.zcode` 下的 `skills/**`、`commands/**`）、MCP 声明（`.mcp.json`、`.cursor/mcp.json`）、共享 settings（`.claude/settings.json`、`.zcode/settings.json`）。
- **中间地带按清单显式选入**：工作区根放一份 `.workspore` 文件，一行一个 glob（`#` 注释；纯目录名按「目录下全部」理解）。清单文件本身随模板走，实例可再固化。没有清单只提示，不报错。
- **脱敏（规则引擎，宁可误拦）**：MCP 声明的 `env`/`headers`、共享 settings 的顶层 `env` 块，值一律换成 `${键名}` 环境变量占位符；凭证文件（`.env`、`*.pem`、`*.key`、含 credential/secret 的文件名等）与素材/产出形态（媒体、归档、二进制、pdf 等）即使选入也整文件拦截，输出里逐个警告。
- **模板 = git 仓库**：默认落在工作区旁 `<工作区名>-template`，可用 `--to` 指定。模板工作区每次镜像本次选入结果——清单里移除的文件，模板里也删掉；所以**人工救回（改模板仓库）的东西要同时回写源工作区或清单，否则下次 save 会被镜像掉**。
- **版本即 tag**：首个版本 `v0.1.0`，之后默认 patch+1；`--minor` / `--major` 手动抬档（约定级破坏性变更标大版本）。无变化则不打新 tag。

## create——落地

```
workspore create <模板路径|URL>[@<tag>] <目标目录>
```

- 从模板落出新工作区，默认取最新 semver tag，`@<tag>` 取指定版本；支持本地路径与 URL（`git clone`）。
- 实例不继承模板 git 历史（`.git` 不复制）；要不要 git 是用户自己的事。
- 写一行出身到 `.workspore-origin`：`<模板>@<版本> (日期)`——这是将来 agent 自主跟上模板新版本的唯一原料（ADR-0003），工具此后不再维护它。
- 占位符原样带进实例，输出会报数量；用户配一次密钥即可开工。

## 分享

模板就是标准 git 仓库：设为公开即公开分享，任何人 clone 即用；无平台、无目录、无市场。

## 开发

```
npm test    # 全部经命令行缝的黑盒测试（node --test）
npm run check
```

测试把 CLI 当黑盒：参数进、外部状态出（文件系统 + git 仓库状态），不断言内部结构（spec 的 Testing Decisions）。
