#!/usr/bin/env node
import { cmdSave } from '../src/save.js'
import { cmdCreate } from '../src/create.js'
import { fail } from '../src/ui.js'

const VERSION = '0.1.0'

const usage = `workspore —— 把调校好的工作区固化为带版本的模板，从模板落出新工作区

用法：
  workspore save [--to <目录>] [--minor | --major] [-m <说明>]
      在工作区内运行：自动收上下文（指令文件原样）与能力（skills、命令、MCP 声明），
      按 .workspore 选入清单收中间地带文件，脱敏打包成 git 模板仓库并自动打版本 tag。

  workspore create <模板路径|URL>[@<tag>] <目标目录>
      从模板落出新工作区（默认最新版本），写入一行出身（.workspore-origin）。

  workspore --help | --version

分工：工具管字节（固化、落地），agent 管语义（整理、合并、引导）。`

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
  if (opts.minor && opts.major) fail('--minor 与 --major 不能同时用')
  return { opts, rest }
}

function main() {
  const argv = process.argv.slice(2)
  const [cmd, ...rest] = argv

  if (cmd === '--help' || cmd === '-h' || !cmd) {
    console.log(usage)
    return
  }
  if (cmd === '--version' || cmd === '-v') {
    console.log(VERSION)
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
  fail(`未知命令：${cmd}\n\n${usage}`)
}

main()
