# Workspore

把调校好的 AI 工作区固化为带版本的模板，从模板一键生成同样调校好的新工作区。两个命令、零依赖、零后端。

- **一键固化**——`save` 把工作区的指令文件（AGENTS.md、CLAUDE.md 等）、skills、命令、MCP 配置打包成 git 模板仓库，一次一个版本 tag。
- **一键复用**——`create` 从模板生成全新工作区，约定、skills、MCP 全部就位，配一次密钥即可开工。
- **密钥不出门**——敏感值自动替换成 `${变量名}` 占位符，凭证文件、素材、产出一律排除；模板仓库可以放心公开。
- **纯 git、无常驻**——版本就是 tag，diff、log、PR 照常用；保存和生成之外工具不做任何事（不跟踪、不更新、不引导）。

## Install

零依赖，Node ≥ 20：

```bash
git clone <本仓库> && cd Workspore
npm link          # 或直接 node bin/workspore.js
```

## Quick start

在调校好的工作区里，把当前配置存成模板：

```bash
$ cd D:\video-workspace
$ workspore save
Saved template to D:\video-workspace-template (v0.1.0)
  collected 12 file(s) (2 context, 10 capability)
  replaced 3 secret value(s) with ${ENV_VAR} placeholders
```

旁边的 `D:\video-workspace-template` 就是一个普通 git 仓库（版本 v0.1.0），里面是指令文件、skills、MCP 声明——密钥已换成占位符。

开新任务时，从模板生成工作区：

```bash
$ workspore create ..\video-workspace-template D:\new-film
Created workspace at D:\new-film
  source: D:\video-workspace-template@v0.1.0 (origin written to .workspore-origin)
warning: 3 placeholder(s) need matching env vars
```

新目录里，目录约定、命名规范、skills、MCP 声明全部就位，agent 读 AGENTS.md 就能按规范开工。给占位符配好环境变量，开工。

## Usage

### workspore save

在工作区内运行，把当前工作区固化成模板（默认落在旁边的 `<名>-template`，`--to` 可指定）。

| 收什么 | 规则 |
| --- | --- |
| 上下文——AGENTS.md、CLAUDE.md 等指令文件 | 自动收，原样，有哪个存哪个 |
| 能力——skills、commands、MCP 声明 | 自动收 |
| 中间地带——脚本、范本、prompt 库 | 仅限 `.workspore` 清单选入（一行一个 glob，`!` 救回误拦） |
| 密钥（MCP env/headers、settings env） | 值换成 `${键名}` 占位符 |
| 家底——素材、产出、凭证文件 | 永不收（宁可误拦，不可漏放） |

版本：首个 `v0.1.0`，之后默认 patch+1；约定级破坏性变更用 `--major`，`--minor` 抬次版本。无变化不产出版本。

### workspore create

```bash
workspore create ../my-template D:\new-task    # 默认最新版本
workspore create ../my-template@v0.1.0 D:\old  # 指定版本
```

写入一行出身（`.workspore-origin`：来源模板与版本），不继承模板 git 历史；之后工具退场。

## Why not just git clone / cookiecutter?

- **vs git clone**：clone 带上全部历史和家底（素材、产出、密钥）。Workspore 只收调校资产、自动脱敏、按 tag 出版本，公开仓库即公开分享。
- **vs cookiecutter / copier**：它们搬目录骨架、做变量渲染、还要维护 update 合并。Workspore 收的是让 agent 自己长出目录的东西（指令文件 + 能力），实例跟进新版本交给工作区里坐着的 agent——不做更新机制。见 ADR-0001/0003。

## Development

```bash
npm test          # 全部经命令行黑盒缝，断言只落文件系统与 git 状态
```

产品定义见 `Workspore产品定义.md`，术语表见 `CONTEXT.md`，决策记录见 `docs/adr/`。
