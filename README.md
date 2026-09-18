# Workspore

脚手架是每个 AI 重度用户交的隐形税——反复交、难沉淀、带不走。Workspore 让它只交一次。

你为某一类任务（视频创作、深度调研……）调校出的工作区——目录怎么摆、文件怎么命名、任务怎么流转、装了哪些 skills 和命令、接了哪些 MCP——才是真正值钱的资产。但它们过去随任务散落在一次性目录里：下次开同类任务从零重搭，或草草开工没用上以前的打磨；换电脑、重装系统要花几小时重配，还总漏掉当年踩坑才补上的设置；想分享，只能整个目录连素材带密钥一起拷。

Workspore 把这件事变成两条命令：

- **save**——把调校好的工作区固化为带版本的模板。上下文（指令文件原样）与能力（skills、命令、MCP 声明）自动收走，密钥自动换成环境变量占位符，凭证与素材永不进模板。模板就是一个标准 git 仓库，版本即 tag。
- **create**——从模板落出新工作区，一落地就是调校好的状态：agent 读着 AGENTS.md 直接按规范开工，你只需配一次密钥。顺手留一行出身（来自哪个模板哪个版本）。

初始化之后工具退场：不跟踪、不更新、不引导——旧工作区跟上模板新版本，是它里面坐着的 agent 的活。分享就是把模板仓库设为公开，任何人 clone 即用；无平台、无市场。

## 上手

零依赖，Node ≥ 20，装完即用：

```bash
npm link        # 或直接 node bin/workspore.js
```

```bash
$ cd D:\video-workspace          # 你调校了半个月的工作区
$ workspore save
Saved template to D:\video-workspace-template (v0.1.0)
  collected 12 file(s) (2 context, 10 capability)
  replaced 3 secret value(s) with ${ENV_VAR} placeholders

$ workspore create ..\video-workspace-template D:\new-film
Created workspace at D:\new-film
  source: D:\video-workspace-template@v0.1.0 (origin written to .workspore-origin)
warning: 3 placeholder(s) need matching env vars before you start
```

新工作区里按占位符提示配一次环境变量，开工。CLI 界面文本为英文，遵循常规 CLI 约定（退出码 0/1/2）。

## 模板收什么

一个 AI 工作区拆开是三样东西：上下文、能力、家底。模板收前两样，外加你显式选入的文件：

| 来源 | 内容 | 规则 |
| --- | --- | --- |
| 上下文 | AGENTS.md、CLAUDE.md 等指令文件 | 有哪个存哪个，原样（ADR-0002） |
| 能力 | skills、commands、MCP 声明 | 自动收 |
| 中间地带 | 脚本、范本、prompt 库 | `.workspore` 清单显式选入 |
| 家底 | 素材、产出、密钥 | 永不进模板 |

目录骨架一个不带——结构写在上下文里，新实例落地时 agent 读着自己长出来（ADR-0001）。这是和传统脚手架工具的分界线：搬的不是目录，是让 agent 自己长出目录的东西。

脱敏是规则引擎：MCP 声明的 env/headers、settings 的 env 块，值一律换成 `${键名}` 占位符；凭证文件（`.env`、`*.pem` 等）与素材/产出形态即使被选入也整文件拦截。宁可误拦、不可漏放。

## 中间地带：`.workspore` 清单

脚本、范本、prompt 库这类中间地带文件默认不进模板——什么值得带走由你决定。在工作区根放一份 `.workspore`，一行一个路径：

```
# 选入清单
prompts/**
scripts/build-video.py
!assets/范本.pdf        ← ! 前缀强制选入（素材误拦的人工救回）
```

支持 glob，`#` 注释，纯目录名按「目录下全部」理解；凭证文件连 `!` 也救不回。清单本身随模板走，实例可以再固化。

## 版本

save 一次 = 一个新版本 = 一个 git tag。首个版本 `v0.1.0`，之后默认 patch 递增；约定级破坏性变更用 `--major` 手动标大版本，`--minor` 抬次版本。无变化不产出版本。diff、log、分支、PR 等 git 全部能力直接可用于管理模板。

## 设计边界

分工一句话：**工具管字节（固化、落地），agent 管语义（整理、合并、引导）**。save 不接 LLM，行为确定、离线、可审计。不做实例更新跟踪、不做首跑引导、不做模板市场——详见 `Workspore产品定义.md` 与 ADR（`docs/adr/`）。

## 开发

测试全部经命令行黑盒缝（spec 的 Testing Decisions），断言只落文件系统与 git 仓库状态：

```bash
npm test
npm run check
```

术语表见 `CONTEXT.md`（模板、实例、上下文、能力、家底、出身），规格见 `.scratch/workspore-cli/spec.md`。
