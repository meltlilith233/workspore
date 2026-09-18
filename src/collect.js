// 选入规则：save 自动收上下文与能力，中间地带按 .workspore 清单显式选入。
// 一切以允许名单为准——清单外与已知名单外的文件一律不进模板（ADR-0001）。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { globToRegex, hasMagic } from './glob.js'

// 上下文：指令文件，有哪个存哪个、原样存（ADR-0002）
const CONTEXT_FILES = [
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  '.cursorrules',
  '.windsurfrules',
  '.github/copilot-instructions.md',
]
const CONTEXT_DIR_GLOBS = ['.cursor/rules/**']

// 能力：skills、命令、MCP 声明、共享 settings
const CAPABILITY_GLOBS = [
  '.claude/skills/**',
  '.claude/commands/**',
  '.agents/skills/**',
  '.zcode/skills/**',
  '.zcode/commands/**',
  '.mcp.json',
  '.cursor/mcp.json',
  '.claude/settings.json',
  '.zcode/settings.json',
]

// 永不进模板的目录段：家底与本地状态（宁可误拦）
const DENY_DIR_SEGMENTS = new Set([
  '.git', 'node_modules', '__pycache__', '.venv', 'venv', '.cache',
  'dist', 'build', 'out', 'coverage',
  'sessions', 'session', 'memory', 'memories', 'logs', 'log', 'todos',
  'projects', 'statsig', 'shell-snapshots', 'cli',
])

// 凭证文件形态：文件名与扩展名双拦
const DENY_BASENAME = [
  /^\.env(\..+)?$/i,
  /^id_(rsa|ed25519|ecdsa|dsa)(\..+)?$/i,
  /credential/i,
  /secret/i,
]
const DENY_KEY_EXT = new Set(['pem', 'key', 'pfx', 'p12', 'kdbx', 'keystore', 'jks'])
// 素材与产出的常见形态
const DENY_ASSET_EXT = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'tif', 'tiff', 'heic', 'svg',
  'mp4', 'mov', 'avi', 'mkv', 'webm', 'flv',
  'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a',
  'zip', 'tar', 'gz', 'tgz', 'bz2', 'xz', '7z', 'rar',
  'exe', 'dll', 'so', 'dylib', 'bin', 'iso', 'class', 'jar',
  'psd', 'ai', 'sketch', 'fig', 'xd', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'onnx', 'pt', 'ckpt', 'safetensors',
])

function denyReason(rel) {
  const base = rel.split('/').pop()
  if (/(^|\/)settings\.local\.json$/i.test(rel)) return '本地状态（settings.local）'
  if (DENY_BASENAME.some((re) => re.test(base))) return '凭证文件'
  const ext = base.includes('.') ? base.split('.').pop().toLowerCase() : ''
  if (DENY_KEY_EXT.has(ext)) return '凭证文件'
  if (DENY_ASSET_EXT.has(ext)) return '素材/产出'
  for (const seg of rel.split('/')) {
    if (DENY_DIR_SEGMENTS.has(seg)) return '家底/本地状态'
  }
  return null
}

function walkFiles(root) {
  const out = []
  const visit = (dir, relBase) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      if (DENY_DIR_SEGMENTS.has(ent.name)) continue
      const rel = relBase ? `${relBase}/${ent.name}` : ent.name
      if (ent.isDirectory()) {
        visit(path.join(dir, ent.name), rel)
      } else if (ent.isFile()) {
        out.push(rel)
      }
    }
  }
  visit(root, '')
  return out
}

function readManifest(ws) {
  const p = path.join(ws, '.workspore')
  if (!existsSync(p) || !statSync(p).isFile()) return { found: false, patterns: [] }
  const lines = readFileSync(p, 'utf8').split(/\r?\n/)
  const patterns = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    patterns.push(line.replaceAll('\\', '/'))
    // 纯目录名（无通配符）按「目录下全部文件」理解
    if (!hasMagic(line) && existsSync(path.join(ws, line)) && statSync(path.join(ws, line)).isDirectory()) {
      patterns.push(`${line}/**`)
    }
  }
  return { found: true, patterns }
}

// 返回 { kept: Map<rel, bucket>, blocked: [{rel, reason}], manifestFound, manifestPatterns }
export function collectSelection(ws) {
  const rels = walkFiles(ws)
  const relSet = new Set(rels)
  const kept = new Map()

  const pick = (patterns, bucket) => {
    for (const rel of rels) {
      if (kept.has(rel)) continue
      if (patterns.some((p) => globToRegex(p).test(rel))) kept.set(rel, bucket)
    }
  }

  pick(CONTEXT_FILES.filter((f) => relSet.has(f)), 'context')
  pick(CONTEXT_DIR_GLOBS, 'context')
  pick(CAPABILITY_GLOBS, 'capability')

  const { found, patterns } = readManifest(ws)
  if (found) {
    kept.set('.workspore', 'manifest')
    pick(patterns, 'optin')
  }

  const blocked = []
  for (const rel of [...kept.keys()]) {
    const reason = denyReason(rel)
    if (reason) {
      blocked.push({ rel, reason })
      kept.delete(rel)
    }
  }
  return { kept, blocked, manifestFound: found, manifestPatterns: patterns }
}

export { walkFiles, denyReason }
