import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { runCli, makeTempRoot, readIfExists } from './helpers.js'
import { makeWorkspace } from './save.test.js'

describe('create', () => {
  test('从模板落出新工作区：文件齐、无 .git、出身一行', (t) => {
    const root = makeTempRoot(t)
    const ws = makeWorkspace(root)
    assert.equal(runCli(['save'], ws).status, 0)
    const tpl = path.join(root, 'ws-template')
    const dest = path.join(root, 'fresh')

    const r = runCli(['create', tpl, dest], root)
    assert.equal(r.status, 0, `stdout: ${r.stdout}\nstderr: ${r.stderr}`)

    assert.equal(readIfExists(path.join(dest, 'AGENTS.md')), '目录约定：素材放 assets/，产出放 output/。')
    assert.ok(existsSync(path.join(dest, '.claude', 'skills', 'video-qa', 'SKILL.md')))
    assert.ok(existsSync(path.join(dest, '.claude', 'commands', 'review.md')))
    assert.ok(existsSync(path.join(dest, '.mcp.json')))
    assert.ok(existsSync(path.join(dest, '.workspore')), '清单随模板走，实例可再固化')
    assert.equal(existsSync(path.join(dest, '.git')), false, '实例不继承模板历史')

    const originPath = path.join(dest, '.workspore-origin')
    assert.ok(existsSync(originPath), '出身必须落地')
    const origin = readFileSync(originPath, 'utf8')
    const lines = origin.split(/\r?\n/).filter(Boolean)
    assert.equal(lines.length, 1, `出身只留一行: ${origin}`)
    assert.ok(lines[0].includes('v0.1.0'), `出身含版本: ${origin}`)
    assert.ok(lines[0].includes('ws-template'), `出身含来源: ${origin}`)

    // 脱敏后的占位符原样带到实例，等用户配一次密钥
    const mcp = readFileSync(path.join(dest, '.mcp.json'), 'utf8')
    assert.ok(mcp.includes('${BROWSER_KEY}'))
    assert.ok(!mcp.includes('bk-secret-123'))
  })

  test('拒绝落到非空目录', (t) => {
    const root = makeTempRoot(t)
    const ws = makeWorkspace(root)
    assert.equal(runCli(['save'], ws).status, 0)
    const dest = path.join(root, 'occupied')
    mkdirSync(dest)
    writeFileSync(path.join(dest, 'something.txt'), '有东西')
    const r = runCli(['create', path.join(root, 'ws-template'), dest], root)
    assert.equal(r.status, 1)
  })

  test('默认取最新版本，ref@tag 可取指定版本', (t) => {
    const root = makeTempRoot(t)
    const ws = makeWorkspace(root)
    assert.equal(runCli(['save'], ws).status, 0)
    const tpl = path.join(root, 'ws-template')
    writeFileSync(path.join(ws, 'AGENTS.md'), '目录约定：第二版。')
    assert.equal(runCli(['save'], ws).status, 0)

    const fromOld = path.join(root, 'from-old')
    assert.equal(runCli(['create', `${tpl}@v0.1.0`, fromOld], root).status, 0)
    assert.equal(readIfExists(path.join(fromOld, 'AGENTS.md')), '目录约定：素材放 assets/，产出放 output/。', '@tag 落地的是那个版本的内容')
    assert.ok(readFileSync(path.join(fromOld, '.workspore-origin'), 'utf8').includes('v0.1.0'))

    const fromLatest = path.join(root, 'from-latest')
    assert.equal(runCli(['create', tpl, fromLatest], root).status, 0)
    assert.equal(readIfExists(path.join(fromLatest, 'AGENTS.md')), '目录约定：第二版。', '不带 tag 默认最新版')
    assert.ok(readFileSync(path.join(fromLatest, '.workspore-origin'), 'utf8').includes('v0.1.1'))
  })

  test('支持 file:// URL 形式的模板地址', (t) => {
    const root = makeTempRoot(t)
    const ws = makeWorkspace(root)
    assert.equal(runCli(['save'], ws).status, 0)
    const tpl = path.join(root, 'ws-template')
    const dest = path.join(root, 'from-url')
    const url = 'file:///' + tpl.replaceAll('\\', '/') + '/'
    const r = runCli(['create', url.replace(/\/+$/, ''), dest], root)
    assert.equal(r.status, 0, `stdout: ${r.stdout}\nstderr: ${r.stderr}`)
    assert.ok(readFileSync(path.join(dest, '.workspore-origin'), 'utf8').includes('v0.1.0'))
    assert.ok(existsSync(path.join(dest, 'AGENTS.md')))
  })

  test('模板不存在时报错', (t) => {
    const root = makeTempRoot(t)
    const dest = path.join(root, 'nowhere-instance')
    const r = runCli(['create', path.join(root, 'no-such-template'), dest], root)
    assert.equal(r.status, 1)
  })
})
