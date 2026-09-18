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

function denyReason(rel, forced = false) {
  const base = rel.split('/').pop()
  if (/(^|\/)settings\.local\.json$/i.test(rel)) return '本地状态（settings.local）'
  // 凭证形态是硬拦截：即使作者 ! 强制选入也不进模板（不可漏放）
  if (DENY_BASENAME.some((re) => re.test(base))) return '凭证文件'
  const ext = base.includes('.') ? base.split('.').pop().toLowerCase() : ''
  if (DENY_KEY_EXT.has(ext)) return '凭证文件'
  if (forced) return null // 显式强制选入只让步给凭证，其余误拦可救回
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
  if (!existsSync(p) || !statSync(p).isFile()) return { found: false, patterns: [], forcedPatterns: [] }
  const lines = readFileSync(p, 'utf8').split(/\r?\n/)
  const patterns = []
  const forcedPatterns = []
  for (const raw of lines) {
    let line = raw.trim()
    if (!line || line === '#' || line.startsWith('#')) continue
    const forced = line.startsWith('!')
    if (forced) line = line.slice(1).trim()
    if (!line) continue
    line = line.replaceAll('\\', '/')
    const target = forced ? forcedPatterns : patterns
    target.push(line)
    // 纯目录名（无通配符）按「目录下全部文件」理解
    if (!hasMagic(line) && existsSync(path.join(ws, line)) && statSync(path.join(ws, line)).isDirectory()) {
      target.push(`${line}/**`)
    }
  }
  return { found: true, patterns, forcedPatterns }
}

// 返回 { kept: Map<rel, bucket>, blocked: [{rel, reason}], manifestFound }
// bucket：context 上下文 / capability 能力 / optin 清单选入 / forced 强制救回
export function collectSelection(ws) {
  const rels = walkFiles(ws)
  const relSet = new Set(rels)
  const kept = new Map()

  const pick = (patterns, bucket, { override = false } = {}) => {
    for (const rel of rels) {
      if (kept.has(rel) && !override) continue
      if (patterns.some((p) => globToRegex(p).test(rel))) kept.set(rel, bucket)
    }
  }

  pick(CONTEXT_FILES.filter((f) => relSet.has(f)), 'context')
  pick(CONTEXT_DIR_GLOBS, 'context')
  pick(CAPABILITY_GLOBS, 'capability')

  const { found, patterns, forcedPatterns } = readManifest(ws)
  if (found) {
    kept.set('.workspore', 'manifest')
    pick(patterns, 'optin')
    pick(forcedPatterns, 'forced', { override: true })
  }

  const blocked = []
  for (const rel of [...kept.keys()]) {
    const reason = denyReason(rel, kept.get(rel) === 'forced')
    if (reason) {
      blocked.push({ rel, reason })
      kept.delete(rel)
    }
  }
  return { kept, blocked, manifestFound: found }
}

export { walkFiles, denyReason }
