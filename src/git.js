import { spawnSync } from 'node:child_process'

export function git(args, opts = {}) {
  return spawnSync('git', args, { encoding: 'utf8', ...opts })
}

export function gitOk(args, opts = {}) {
  const r = git(args, opts)
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} 失败：${(r.stderr || r.stdout || '').trim()}`)
  }
  return (r.stdout || '').trim()
}

// 提交：机器没有全局 git 身份时降级为工具身份，保证 save 在裸机器上也能跑通
export function commit(message, cwd) {
  const r = git(['commit', '-m', message], { cwd })
  if (r.status === 0) return
  if (!/user\.name|user\.email|ident/i.test(r.stderr || '')) {
    throw new Error(`git commit 失败：${(r.stderr || '').trim()}`)
  }
  const r2 = git(
    ['-c', 'user.name=workspore', '-c', 'user.email=workspore@localhost', 'commit', '-m', message],
    { cwd },
  )
  if (r2.status !== 0) throw new Error(`git commit 失败：${(r2.stderr || '').trim()}`)
}

export function gitTags(cwd) {
  const r = git(['tag', '--list'], { cwd })
  return r.status === 0 ? r.stdout.split(/\r?\n/).filter(Boolean) : []
}
