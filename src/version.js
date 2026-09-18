// semver tag：解析、比较、取最新、算下一个。版本即 tag（v前缀）。
export function parseVersion(tag) {
  const m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

export function formatVersion(v) {
  return `v${v.join('.')}`
}

function compare(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return 0
}

export function latestVersion(tags) {
  let best = null
  for (const t of tags) {
    const v = parseVersion(t)
    if (v && (!best || compare(v, best) > 0)) best = v
  }
  return best ? formatVersion(best) : null
}

// 首个版本 v0.1.0（--major 则 v1.0.0）；之后默认 patch+1，--minor / --major 手动抬档
export function nextVersion(tags, opts) {
  const best = latestVersion(tags)
  const v = best ? parseVersion(best) : null
  if (!v) return opts.major ? 'v1.0.0' : 'v0.1.0'
  if (opts.major) return `v${v[0] + 1}.0.0`
  if (opts.minor) return `v${v[0]}.${v[1] + 1}.0`
  return `v${v[0]}.${v[1]}.${v[2] + 1}`
}
