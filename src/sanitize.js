// 脱敏规则引擎：只处理已知密钥位置（spec 定死的三类）：
// 1) MCP 声明的 env/headers —— 值一律换成 `${键名}` 占位符（宁可误拦）
// 2) 共享 settings 的顶层 env 块 —— 同上
// 3) 常见密钥文件形态 —— 在 collect 层整文件拦截，不在这里
// 其余文件字节不动。语义级的第二道网是将来 LLM 接入的事（记录待议）。
const SETTINGS_FILES = new Set(['.claude/settings.json', '.zcode/settings.json'])

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

export function sanitizeJson(rel, text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return { text, replaced: 0 }
  }
  if (!isPlainObject(data)) return { text, replaced: 0 }
  let replaced = 0

  const placeholderize = (obj) => {
    for (const k of Object.keys(obj)) {
      obj[k] = `\${${k}}`
      replaced++
    }
  }

  if (SETTINGS_FILES.has(rel) && isPlainObject(data.env)) placeholderize(data.env)
  if (isPlainObject(data.mcpServers)) {
    for (const server of Object.values(data.mcpServers)) {
      if (!isPlainObject(server)) continue
      if (isPlainObject(server.env)) placeholderize(server.env)
      if (isPlainObject(server.headers)) placeholderize(server.headers)
    }
  }

  if (replaced === 0) return { text, replaced: 0 }
  return { text: JSON.stringify(data, null, 2) + '\n', replaced }
}
