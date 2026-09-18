export function fail(msg) {
  console.error(`workspore: ${msg}`)
  process.exit(1)
}

export function say(msg) {
  console.log(msg)
}
