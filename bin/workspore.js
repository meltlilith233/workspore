#!/usr/bin/env node
import { cmdSave } from '../src/save.js'
import { cmdCreate } from '../src/create.js'
import { fail } from '../src/ui.js'

const VERSION = '0.1.0'

const usage = `workspore v${VERSION} —— 把调校好的 AI 工作区固化为模板，从模板落出新工作区

用法：
  workspore save [工作区] [选项]          固化工作区为带版本的模板（git 仓库）
  workspore create <模板>[@<tag>] <目录>  从模板落出新工作区
  workspore help                         显示本帮助

save 选项：
  --to <目录>   模板保存位置（默认：工作区旁的 <工作区名>-template）
  --minor       次版本递增（v0.1.0 → v0.2.0）
  --major       主版本递增（v0.1.0 → v1.0.0），约定级破坏性变更时用
  -m <说明>     本次版本的提交说明

模板收什么：
  · 自动收：指令文件（AGENTS.md、CLAUDE.md 等，原样）与能力（.claude、
    .agents、.zcode 下的 skills、commands，.mcp.json 等 MCP 声明）；
    密钥自动换成 \${环境变量} 占位符。
  · 手动收：脚本、范本等中间地带文件默认不进模板——在工作区根放一份
    .workspore 清单，一行一个路径（支持 glob；! 前缀可救回误拦的素材；
    凭证文件任何方式都不进）。

create 说明：
  <模板> 为本地路径或 git URL；默认取最新版本，@<tag> 可指定版本。
  落地后写一行出身（.workspore-origin），此后工具退场——旧工作区跟进
  模板新版本，交给它里面的 agent。

示例：
  workspore save                               # 固化当前工作区 → ../<名>-template
  workspore save --major -m "重写目录约定"      # 破坏性变更，升大版本
  workspore create ../my-template D:\\new       # 从最新版本落出新工作区
  workspore create ../my-template@v0.1.0 D:\\new`

function main() {
  const argv = process.argv.slice(2)
  const [cmd, ...rest] = argv

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(usage)
    return
  }
  if (cmd === '--version' || cmd === '-v') {
    console.log(VERSION)
    return
  }
  if ((cmd === 'save' || cmd === 'create') && rest.some((a) => a === '-h' || a === '--help')) {
    console.log(usage)
    return
  }
  if (cmd === 'save') {
    const { opts, rest: pos } = parseSaveArgs(rest)
    if (pos.length > 1) fail('save 最多接受一个工作区参数（默认当前目录）')
    cmdSave(pos[0], opts)
    return
  }
  if (cmd === 'create') {
    cmdCreate(...rest)
    return
  }
  fail(`未知命令：${cmd}\n运行 workspore help 查看用法。`)
}

function parseSaveArgs(argv) {
  const opts = { to: null, minor: false, major: false, message: null }
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--to') opts.to = argv[++i] ?? fail('--to 需要一个目录参数')
    else if (a.startsWith('--to=')) opts.to = a.slice(5)
    else if (a === '--minor') opts.minor = true
    else if (a === '--major') opts.major = true
    else if (a === '-m' || a === '--message') opts.message = argv[++i] ?? fail('-m 需要一个说明参数')
    else if (a.startsWith('--message=')) opts.message = a.slice(10)
    else rest.push(a)
  }
  if (opts.minor && opts.major) fail('--minor 与 --major 不能同时使用')
  return { opts, rest }
}

main()
