// create：从模板落出新工作区，落地即巅峰；顺手留一行出身（.workspore-origin）。
// 不复制 .git——实例不继承模板历史；实例要不要 git，是用户自己的事。
import {
  existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, statSync, cpSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { gitOk, gitTags } from './git.js'
import { latestVersion } from './version.js'
import { fail, say } from './ui.js'

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
    fail('用法：workspore create <模板路径|URL>[@<tag>] <目标目录>\n运行 workspore help 查看详情。')
  }

  const dest = path.resolve(destArg)
  if (existsSync(dest)) {
    if (!statSync(dest).isDirectory()) fail(`目标已存在且不是目录：${dest}`)
    if (readdirSync(dest).length > 0) fail(`目标目录非空：${dest}\ncreate 只落进空目录，请换一个目标或先清空。`)
  }

  const { ref, tag: wantTag } = parseRef(refArg)
  const isLocal = !URL_RE.test(ref) && !SCP_RE.test(ref)
  if (isLocal) {
    const abs = path.resolve(ref)
    if (!existsSync(abs) || !existsSync(path.join(abs, '.git'))) {
      fail(`模板不存在或不是 git 仓库：${abs}\n本地路径或 git URL 均可，模板需先经 workspore save 产出。`)
    }
  }
  const originRef = isLocal ? path.resolve(ref) : ref

  const tmp = mkdtempSync(path.join(tmpdir(), 'workspore-create-'))
  try {
    gitOk(['clone', '-q', ref, tmp])

    const tags = gitTags(tmp)
    let version = wantTag
    if (version) {
      if (!tags.includes(version)) fail(`模板没有这个版本：${version}（现有：${tags.join(', ') || '无'}）`)
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
    say(`新工作区已就绪 → ${dest}`)
    say(`  来源 ${originRef}@${version}（出身已写入 .workspore-origin）`)
    if (placeholders > 0) {
      say(`  待配置：${placeholders} 处密钥占位符（形如 \${变量名}），填好对应环境变量即可开工`)
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}
