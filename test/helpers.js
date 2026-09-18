import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const CLI = path.resolve(fileURLToPath(import.meta.url), '../../bin/workspore.js')

export function runCli(args, cwd) {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' })
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

export function makeTempRoot(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'workspore-test-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

// 假源工作区：指令文件、能力、故意埋的假密钥、选入清单与中间地带文件
export function makeWorkspace(root, name = 'ws') {
  const ws = path.join(root, name)
  mkdirSync(ws, { recursive: true })
  writeFileSync(path.join(ws, 'AGENTS.md'), '目录约定：素材放 assets/，产出放 output/。')
  writeFileSync(path.join(ws, 'CLAUDE.md'), '命名规范：kebab-case。')
  mkdirSync(path.join(ws, '.claude', 'skills', 'video-qa'), { recursive: true })
  writeFileSync(path.join(ws, '.claude', 'skills', 'video-qa', 'SKILL.md'), '---\nname: video-qa\n---\n做视频质检。')
  mkdirSync(path.join(ws, '.claude', 'commands'), { recursive: true })
  writeFileSync(path.join(ws, '.claude', 'commands', 'review.md'), '审查当前目录。')
  mkdirSync(path.join(ws, '.agents', 'skills', 'research'), { recursive: true })
  writeFileSync(path.join(ws, '.agents', 'skills', 'research', 'SKILL.md'), '深度调研技能。')
  writeFileSync(
    path.join(ws, '.mcp.json'),
    JSON.stringify({ mcpServers: { browser: { command: 'npx', env: { BROWSER_KEY: 'bk-secret-123' }, headers: { Authorization: 'Bearer h-secret' } } } }, null, 2),
  )
  writeFileSync(
    path.join(ws, '.claude', 'settings.json'),
    JSON.stringify({ env: { API_TOKEN: 'sk-live-abc', LOG_LEVEL: 'debug' }, permissions: { allow: ['Bash'] } }, null, 2),
  )
  writeFileSync(path.join(ws, '.claude', 'settings.local.json'), '{"env":{"LOCAL_SECRET":"x"}}')
  writeFileSync(path.join(ws, '.env'), 'SECRET=1')
  mkdirSync(path.join(ws, 'assets'), { recursive: true })
  writeFileSync(path.join(ws, 'assets', 'clip.mp4'), 'fakevideo')
  mkdirSync(path.join(ws, 'prompts'), { recursive: true })
  writeFileSync(path.join(ws, 'prompts', 'intro.md'), '开场白范本。')
  writeFileSync(path.join(ws, 'keys.pem'), '-----BEGIN RSA PRIVATE KEY-----')
  writeFileSync(path.join(ws, '.workspore'), '# 选入清单\nprompts/**\nkeys.pem\nassets/clip.mp4\n')
  return ws
}

export function git(cwd, ...args) {
  return spawnSync('git', args, { cwd, encoding: 'utf8' })
}

export function gitOut(cwd, ...args) {
  const r = git(cwd, ...args)
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`)
  return r.stdout.trim()
}

export function tags(repo) {
  return gitOut(repo, 'tag', '--list').split('\n').filter(Boolean)
}

export function readIfExists(p) {
  try {
    return readFileSync(p, 'utf8')
  } catch {
    return undefined
  }
}
