// save：把调校好的工作区固化成带版本的模板（git 仓库，版本即 tag）。
// 模板工作区镜像选入结果：清单里移除的文件，模板里也删掉。
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { collectSelection, walkFiles } from './collect.js'
import { sanitizeJson } from './sanitize.js'
import { commit, git, gitOk, gitTags } from './git.js'
import { nextVersion, latestVersion } from './version.js'
import { fail, say } from './ui.js'

function resolveTarget(ws, opts) {
  if (opts.to) return path.resolve(opts.to)
  const parent = path.dirname(ws)
  return path.join(parent, `${path.basename(ws)}-template`)
}

function syncTemplate(target, files, selectedRels) {
  // 镜像：模板里已有但这次没选中的，删掉
  for (const rel of walkFiles(target)) {
    if (!selectedRels.has(rel)) rmSync(path.join(target, rel), { force: true })
  }
  for (const f of files) {
    const abs = path.join(target, f.rel)
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, f.content)
  }
}

export function cmdSave(wsArg, opts) {
  const ws = path.resolve(wsArg || '.')
  if (!existsSync(ws) || !statSync(ws).isDirectory()) {
    fail(`工作区不存在：${ws}\n请确认路径，或先 cd 进工作区再运行 save。`)
  }

  const { kept, blocked, manifestFound } = collectSelection(ws)
  if (!manifestFound) {
    say('提示：未发现 .workspore 清单——脚本、范本等中间地带文件没有收进模板（workspore help 查看说明）')
  }
  if (kept.size === 0) {
    fail('没有发现可固化的内容：未找到指令文件（AGENTS.md、CLAUDE.md 等）或能力（skills、命令、MCP 声明）。\n运行 workspore help 查看模板收集范围。')
  }

  // 读内容并脱敏：JSON 走规则引擎，其余字节原样
  const files = []
  let replaced = 0
  for (const [rel, bucket] of kept) {
    const abs = path.join(ws, rel)
    if (rel.endsWith('.json')) {
      const { text, replaced: n } = sanitizeJson(rel, readFileSync(abs, 'utf8'))
      replaced += n
      files.push({ rel, bucket, content: text })
    } else {
      files.push({ rel, bucket, content: readFileSync(abs) })
    }
  }

  const target = resolveTarget(ws, opts)
  if (existsSync(target)) {
    if (!existsSync(path.join(target, '.git'))) {
      fail(`目标目录已存在且不是 git 仓库：${target}\n换用 --to 指定其他目录。`)
    }
  } else {
    mkdirSync(target, { recursive: true })
    gitOk(['init', '-b', 'main'], { cwd: target })
  }

  syncTemplate(target, files, new Set(kept.keys()))
  gitOk(['add', '-A'], { cwd: target })

  const status = git(['status', '--porcelain'], { cwd: target })
  const dirty = status.status === 0 && status.stdout.trim() !== ''
  if (!dirty) {
    const latest = latestVersion(gitTags(target))
    say(`无变化：与 ${latest ?? '上次保存'} 相同，未生成新版本 → ${target}`)
    return
  }

  const version = nextVersion(gitTags(target), opts)
  const message = opts.message || `workspore save ${version}`
  commit(message, target)
  gitOk(['tag', '-a', version, '-m', message], { cwd: target })

  const tally = { context: 0, capability: 0, optin: 0, forced: 0, manifest: 0 }
  for (const b of kept.values()) tally[b]++
  const parts = []
  if (tally.context) parts.push(`上下文 ${tally.context}`)
  if (tally.capability) parts.push(`能力 ${tally.capability}`)
  if (tally.optin) parts.push(`选入 ${tally.optin}`)
  if (tally.forced) parts.push(`救回 ${tally.forced}`)
  say(`模板已保存 → ${target}（${version}）`)
  say(`  收集 ${kept.size} 个文件：${parts.join(' · ')}`)
  if (replaced > 0) say(`  脱敏 ${replaced} 处密钥 → \${环境变量} 占位符`)
  if (blocked.length > 0) {
    say(`  拦截 ${blocked.length} 个文件（宁可误拦）：`)
    for (const { rel, reason } of blocked) say(`    ${rel}（${reason}）`)
    if (blocked.some((b) => b.reason !== '凭证文件')) {
      say('  素材/家底类误拦可在 .workspore 清单用 ! 前缀强制救回；凭证文件不救')
    }
  }
  if (version === 'v0.1.0') {
    say(`  下一步：开新任务 → workspore create ${target} <目标目录>`)
  }
}
