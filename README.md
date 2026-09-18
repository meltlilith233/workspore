# Workspore

脚手架是每个 AI 重度用户交的隐形税——反复交、难沉淀、带不走。Workspore 让它只交一次。

把调校好的 AI 工作区固化为带版本的模板，新工作区一落地就是调校好的状态。两个命令，零依赖（Node ≥ 20）：

```bash
$ cd D:\video-workspace            # 调校好的工作区
$ workspore save
Saved template to D:\video-workspace-template (v0.1.0)
  collected 12 file(s) (2 context, 10 capability)
  replaced 3 secret value(s) with ${ENV_VAR} placeholders

$ workspore create ..\video-workspace-template D:\new-film
Created workspace at D:\new-film
  source: ...@v0.1.0 (origin written to .workspore-origin)
```

配一次密钥，开工。

## 收什么，不收什么

| 来源 | 规则 |
| --- | --- |
| 上下文——AGENTS.md 等指令文件 | 收，原样，有哪个存哪个 |
| 能力——skills、命令、MCP 声明 | 收，自动 |
| 中间地带——脚本、范本、prompt 库 | 收，仅限 `.workspore` 清单选入（一行一个 glob，`!` 救回误拦） |
| 密钥（MCP env/headers、settings env） | 换成 `${键名}` 占位符，实例里配一次 |
| 家底——素材、产出、凭证文件 | 永不收（宁可误拦，不可漏放） |

不搬目录骨架：结构写在上下文里，agent 落地后自己长出来。

## 三条边界

- **模板就是 git 仓库**——save 一次打一个 tag（v0.1.0 起，默认 patch+1，`--major` 标破坏性变更），diff、log、PR 直接可用。
- **分享就是公开仓库**——无平台、无市场，任何人 clone 即用。
- **初始化后工具退场**——不跟踪、不更新、不引导；旧工作区跟上模板新版本，交给它里面的 agent。

## 开发

```bash
npm test     # 全部经命令行黑盒缝，断言只落文件系统与 git 状态
```

产品定义见 Workspore产品定义.md，术语表见 CONTEXT.md，决策记录见 docs/adr/。
