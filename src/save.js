// save：把调校好的工作区固化成带版本的模板（git 仓库，版本即 tag）。
// 模板工作区镜像选入结果：清单里移除的文件，模板里也删掉。
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { collectSelection, walkFiles } from './collect.js'
import { sanitizeJson } from './sanitize.js'
import { commit, git, gitOk, gitTags } from './git.js'
import { nextVersion, latestVersion } from './version.js'
import { fail, hint, say } from './ui.js'

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
    fail(`workspace not found: ${ws}\ncheck the path, or cd into the workspace and run save again.`)
  }

  const { kept, blocked, manifestFound } = collectSelection(ws)
  if (!manifestFound) {
    hint('no .workspore manifest found; extra files will not be collected')
  }
  if (kept.size === 0) {
    fail("nothing to save: no instruction files or capability files found\nsee 'workspore help' for what gets collected")
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
      fail(`target exists but is not a git repository: ${target}\npick another directory with --to.`)
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
    say(`No changes since ${latest ?? 'the last save'}; no new version created.`)
    return
  }

  const version = nextVersion(gitTags(target), opts)
  const message = opts.message || `workspore save ${version}`
  commit(message, target)
  gitOk(['tag', '-a', version, '-m', message], { cwd: target })

  const tally = { context: 0, capability: 0, optin: 0, forced: 0, manifest: 0 }
  for (const b of kept.values()) tally[b]++
  const parts = []
  if (tally.context) parts.push(`${tally.context} context`)
  if (tally.capability) parts.push(`${tally.capability} capability`)
  if (tally.optin) parts.push(`${tally.optin} opt-in`)
  if (tally.forced) parts.push(`${tally.forced} forced`)
  say(`Saved template to ${target} (${version})`)
  say(`  collected ${kept.size} file(s) (${parts.join(', ')})`)
  if (replaced > 0) say(`  replaced ${replaced} secret value(s) with \${ENV_VAR} placeholders`)
  if (blocked.length > 0) {
    say(`  skipped ${blocked.length} file(s):`)
    for (const { rel, reason } of blocked) say(`    ${rel} (${reason})`)
    if (blocked.some((b) => b.reason !== 'credential')) {
      hint("force-include false positives with '!' lines in .workspore")
    }
  }
  if (version === 'v0.1.0') {
    const rel = path.relative(ws, target)
    say(`  next: workspore create ${rel} <dir>`)
  }
}
