import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
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
