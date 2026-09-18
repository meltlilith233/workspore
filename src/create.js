// create：从模板落出新工作区，落地即巅峰；顺手留一行出身（.workspore-origin）。
// 不复制 .git——实例不继承模板历史；实例要不要 git，是用户自己的事。
import {
  existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, statSync, cpSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { gitOk, gitTags } from './git.js'
import { latestVersion } from './version.js'
import { fail, failUsage, say, warn } from './ui.js'

const URL_RE = /^[a-z][a-z0-9+.-]*:\/\//i
const SCP_RE = /^[^/]+@[^/]+:/
const TAG_RE = /^[A-Za-z0-9._-]+$/

export function parseRef(ref) {
  // <路径|URL>[@<tag>]：仅当去掉 @tag 后本地真实存在时，才按 @tag 理解，避免误伤含 @ 的 URL
  const at = ref.lastIndexOf('@')
  if (at > 0) {
    const base = ref.slice(0, at)
    const tag = ref.slice(at + 1)
    if (TAG_RE.test(tag) && existsSync(path.join(base, '.git'))) {
      return { ref: base, tag }
    }
  }
  return { ref, tag: null }
}

function countPlaceholders(dir) {
  let n = 0
  const visit = (d) => {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name)
      if (ent.isDirectory()) visit(p)
      else if (ent.isFile()) {
        const buf = readFileSync(p)
        if (buf.includes(0)) continue // 二进制不数
        const m = buf.toString('utf8').match(/\$\{[^}\s]+\}/g)
        if (m) n += m.length
      }
    }
  }
  visit(dir)
  return n
}

export function cmdCreate(refArg, destArg) {
  if (!refArg || !destArg) {
    failUsage('usage: workspore create <template|url>[@<tag>] <dir>')
  }

  const dest = path.resolve(destArg)
  if (existsSync(dest)) {
    if (!statSync(dest).isDirectory()) fail(`destination exists and is not a directory: ${dest}`)
    if (readdirSync(dest).length > 0) fail(`destination is not empty: ${dest}\ncreate only fills an empty directory.`)
  }

  const { ref, tag: wantTag } = parseRef(refArg)
  const isLocal = !URL_RE.test(ref) && !SCP_RE.test(ref)
  if (isLocal) {
    const abs = path.resolve(ref)
    if (!existsSync(abs) || !existsSync(path.join(abs, '.git'))) {
      fail(`template not found or not a git repository: ${abs}\nuse a local path or a git URL; templates are produced by 'workspore save'.`)
    }
  }
  const originRef = isLocal ? path.resolve(ref) : ref

  const tmp = mkdtempSync(path.join(tmpdir(), 'workspore-create-'))
  try {
    gitOk(['clone', '-q', ref, tmp])

    const tags = gitTags(tmp)
    let version = wantTag
    if (version) {
      if (!tags.includes(version)) fail(`template has no version ${version} (available: ${tags.join(', ') || 'none'})`)
    } else {
      version = latestVersion(tags) ?? 'HEAD'
    }
    if (version !== 'HEAD') gitOk(['checkout', '-q', '--detach', version], { cwd: tmp })

    mkdirSync(dest, { recursive: true })
    cpSync(tmp, dest, {
      recursive: true,
      filter: (src) => {
        const rel = path.relative(tmp, src)
        return rel === '' || (rel !== '.git' && !rel.startsWith(`.git${path.sep}`))
      },
    })

    const today = new Date().toISOString().slice(0, 10)
    writeFileSync(path.join(dest, '.workspore-origin'), `${originRef}@${version} (${today})\n`)

    const placeholders = countPlaceholders(dest)
    say(`Created workspace at ${dest}`)
    say(`  source: ${originRef}@${version} (origin written to .workspore-origin)`)
    if (placeholders > 0) {
      warn(`${placeholders} placeholder(s) need matching env vars before you start`)
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}
