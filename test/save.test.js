import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { runCli, makeTempRoot, gitOut, tags, readIfExists, makeWorkspace } from './helpers.js'

describe('save', () => {
  test('把上下文、能力、选入文件固化进新模板仓库，并打首个 tag', (t) => {
    const root = makeTempRoot(t)
    const ws = makeWorkspace(root)
    const r = runCli(['save'], ws)
    assert.equal(r.status, 0, `stdout: ${r.stdout}\nstderr: ${r.stderr}`)

    const tpl = path.join(root, 'ws-template')
    assert.ok(existsSync(path.join(tpl, '.git')), '模板应是 git 仓库')

    // 上下文：原样
    assert.equal(readIfExists(path.join(tpl, 'AGENTS.md')), '目录约定：素材放 assets/，产出放 output/。')
    assert.equal(readIfExists(path.join(tpl, 'CLAUDE.md')), '命名规范：kebab-case。')
    // 能力：skills、命令、MCP、settings
    assert.equal(readIfExists(path.join(tpl, '.claude', 'skills', 'video-qa', 'SKILL.md')), '---\nname: video-qa\n---\n做视频质检。')
    assert.ok(existsSync(path.join(tpl, '.claude', 'commands', 'review.md')))
    assert.ok(existsSync(path.join(tpl, '.agents', 'skills', 'research', 'SKILL.md')))
    assert.ok(existsSync(path.join(tpl, '.mcp.json')))
    assert.ok(existsSync(path.join(tpl, '.claude', 'settings.json')))
    // 选入清单本身与选入文件
    assert.ok(existsSync(path.join(tpl, '.workspore')))
    assert.equal(readIfExists(path.join(tpl, 'prompts', 'intro.md')), '开场白范本。')

    // 家底与凭证：一律不进
    assert.equal(existsSync(path.join(tpl, '.env')), false)
    assert.equal(existsSync(path.join(tpl, '.claude', 'settings.local.json')), false)
    assert.equal(existsSync(path.join(tpl, 'keys.pem')), false, '凭证文件即使选入也不进')
    assert.equal(existsSync(path.join(tpl, 'assets', 'clip.mp4')), false, '素材即使选入也不进')

    // 版本即 tag
    assert.deepEqual(tags(tpl), ['v0.1.0'])
    assert.ok(gitOut(tpl, 'log', '--oneline').length > 0)
  })

  test('脱敏：MCP env/headers 与 settings env 换占位符，原值不出现', (t) => {
    const root = makeTempRoot(t)
    const ws = makeWorkspace(root)
    runCli(['save'], ws)
    const tpl = path.join(root, 'ws-template')

    const mcp = readFileSync(path.join(tpl, '.mcp.json'), 'utf8')
    assert.ok(mcp.includes('${BROWSER_KEY}'), `应含占位符: ${mcp}`)
    assert.ok(mcp.includes('${Authorization}'), `headers 也应占位: ${mcp}`)
    assert.ok(!mcp.includes('bk-secret-123'))
    assert.ok(!mcp.includes('h-secret'))
    assert.ok(mcp.includes('"command": "npx"'), '非密钥字段保留')

    const settings = readFileSync(path.join(tpl, '.claude', 'settings.json'), 'utf8')
    assert.ok(settings.includes('${API_TOKEN}'))
    assert.ok(settings.includes('${LOG_LEVEL}'), 'env 块一律占位（宁可误拦）')
    assert.ok(!settings.includes('sk-live-abc'))
    assert.ok(settings.includes('"allow"'), 'env 之外的字段保留')
  })

  test('清单 ! 强制选入可救回素材误拦，凭证即使强制也不进', (t) => {
    const root = makeTempRoot(t)
    const ws = makeWorkspace(root)
    writeFileSync(path.join(ws, '.workspore'), '# 选入清单\n!assets/clip.mp4\n!keys.pem\n')
    const r = runCli(['save'], ws)
    assert.equal(r.status, 0, r.stderr)

    const tpl = path.join(root, 'ws-template')
    assert.equal(readIfExists(path.join(tpl, 'assets', 'clip.mp4')), 'fakevideo', '素材误拦经 ! 救回')
    assert.equal(existsSync(path.join(tpl, 'keys.pem')), false, '凭证形态不可救回（不可漏放）')
  })

  test('二次 save 递增 patch 版本，并镜像删除已移除的文件', (t) => {
    const root = makeTempRoot(t)
    const ws = makeWorkspace(root)
    runCli(['save'], ws)
    const tpl = path.join(root, 'ws-template')

    rmSync(path.join(ws, 'prompts', 'intro.md'))
    writeFileSync(path.join(ws, '.workspore'), '# 选入清单\nkeys.pem\nassets/clip.mp4\n')
    writeFileSync(path.join(ws, 'AGENTS.md'), '目录约定：改版。')
    const r = runCli(['save'], ws)
    assert.equal(r.status, 0, r.stderr)

    assert.deepEqual(tags(tpl), ['v0.1.0', 'v0.1.1'])
    assert.equal(existsSync(path.join(tpl, 'prompts', 'intro.md')), false, '清单移除后模板里也删掉')
    assert.equal(readIfExists(path.join(tpl, 'AGENTS.md')), '目录约定：改版。')
  })

  test('无变化时不打新 tag', (t) => {
    const root = makeTempRoot(t)
    const ws = makeWorkspace(root)
    runCli(['save'], ws)
    const r = runCli(['save'], ws)
    assert.equal(r.status, 0, r.stderr)
    assert.deepEqual(tags(path.join(root, 'ws-template')), ['v0.1.0'])
  })

  test('--minor 与 --major 手动标大版本', (t) => {
    const root = makeTempRoot(t)
    const ws = makeWorkspace(root)
    runCli(['save'], ws)
    writeFileSync(path.join(ws, 'prompts', 'intro.md'), '改一版')
    runCli(['save', '--minor'], ws)
    writeFileSync(path.join(ws, 'prompts', 'intro.md'), '再改一版')
    runCli(['save', '--major'], ws)
    assert.deepEqual(tags(path.join(root, 'ws-template')), ['v0.1.0', 'v0.2.0', 'v1.0.0'])
  })

  test('--to 指定模板目录', (t) => {
    const root = makeTempRoot(t)
    const ws = makeWorkspace(root)
    const r = runCli(['save', '--to', path.join(root, 'my-tpl')], ws)
    assert.equal(r.status, 0, r.stderr)
    assert.deepEqual(tags(path.join(root, 'my-tpl')), ['v0.1.0'])
  })

  test('目标目录存在但不是 git 仓库时报错', (t) => {
    const root = makeTempRoot(t)
    const ws = makeWorkspace(root)
    mkdirSync(path.join(root, 'junk'))
    writeFileSync(path.join(root, 'junk', 'x.txt'), '占着地方')
    const r = runCli(['save', '--to', path.join(root, 'junk')], ws)
    assert.equal(r.status, 1)
    assert.ok(r.stderr.length > 0)
  })

  test('没有可固化内容时报错', (t) => {
    const root = makeTempRoot(t)
    const ws = path.join(root, 'bare')
    mkdirSync(ws)
    const r = runCli(['save'], ws)
    assert.equal(r.status, 1)
    assert.ok(r.stderr.length > 0)
  })

  test('中文工作区名正常工作（Windows 路径）', (t) => {
    const root = makeTempRoot(t)
    const ws = makeWorkspace(root, '视频工作区')
    const r = runCli(['save'], ws)
    assert.equal(r.status, 0, `stdout: ${r.stdout}\nstderr: ${r.stderr}`)
    assert.deepEqual(tags(path.join(root, '视频工作区-template')), ['v0.1.0'])
  })
})
