export function fail(msg) {
  console.error(`error: ${msg}`)
  process.exit(1)
}

// 用法类错误（未知命令、缺参数）：GNU 约定退出码 2，并提示 help
export function failUsage(msg) {
  console.error(`error: ${msg}`)
  console.error(`Try 'workspore --help' for more information.`)
  process.exit(2)
}

export function hint(msg) {
  console.error(`hint: ${msg}`)
}

export function warn(msg) {
  console.error(`warning: ${msg}`)
}

export function say(msg) {
  console.log(msg)
}
