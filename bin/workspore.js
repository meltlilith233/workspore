#!/usr/bin/env node
import { cmdSave } from '../src/save.js'
import { cmdCreate } from '../src/create.js'
import { fail, failUsage } from '../src/ui.js'

const VERSION = '0.1.0'

const usage = `workspore ${VERSION} - Turn a tuned AI workspace into a versioned template

Usage:
  workspore save [<workspace>] [options]
  workspore create <template>[@<tag>] <dir>
  workspore help

Options:
  -t, --to <dir>       template destination (default: ../<name>-template)
      --minor          bump minor version (v0.1.0 -> v0.2.0)
      --major          bump major version (v0.1.0 -> v1.0.0), for
                       convention-level breaking changes
  -m, --message <msg>  commit message for this version
  -h, --help           show this help
  -V, --version        show version

What goes into a template:
  collected automatically:
    context     instruction files (AGENTS.md, CLAUDE.md, ...), stored as-is
    capability  skills, commands, MCP declarations
                (.claude/.agents/.zcode skills & commands, .mcp.json, ...)
  secrets in MCP env/headers and settings env blocks are replaced with
  \${ENV_VAR} placeholders; credential-shaped files are never included.
  opt in extra files (scripts, snippets, prompts) via a .workspore manifest
  in the workspace root, one glob per line; a '!' prefix force-includes
  false positives.

Notes:
  create checks out the latest version by default, or a given one with
  @<tag>. It writes a single origin line (.workspore-origin) and then
  leaves: keeping an instance in sync with newer template versions is the
  resident agent's job, not this tool's.

Examples:
  workspore save
  workspore save --major -m "rework directory conventions"
  workspore create ../my-template D:\\new
  workspore create ../my-template@v0.1.0 D:\\new`

function main() {
  const argv = process.argv.slice(2)
  const [cmd, ...rest] = argv

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(usage)
    return
  }
  if (cmd === '--version' || cmd === '-V') {
    console.log(VERSION)
    return
  }
  if ((cmd === 'save' || cmd === 'create') && rest.some((a) => a === '-h' || a === '--help')) {
    console.log(usage)
    return
  }
  if (cmd === 'save') {
    const { opts, rest: pos } = parseSaveArgs(rest)
    if (pos.length > 1) failUsage('save takes at most one workspace argument (defaults to the current directory)')
    cmdSave(pos[0], opts)
    return
  }
  if (cmd === 'create') {
    cmdCreate(...rest)
    return
  }
  failUsage(`unknown command '${cmd}'`)
}

function parseSaveArgs(argv) {
  const opts = { to: null, minor: false, major: false, message: null }
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--to' || a === '-t') opts.to = argv[++i] ?? failUsage('--to requires a directory argument')
    else if (a.startsWith('--to=')) opts.to = a.slice(5)
    else if (a === '--minor') opts.minor = true
    else if (a === '--major') opts.major = true
    else if (a === '-m' || a === '--message') opts.message = argv[++i] ?? failUsage('-m requires a message argument')
    else if (a.startsWith('--message=')) opts.message = a.slice(10)
    else rest.push(a)
  }
  if (opts.minor && opts.major) failUsage('--minor and --major are mutually exclusive')
  return { opts, rest }
}

main()
