// 极简 glob，只覆盖选入清单所需语法：`**`（跨目录）、`*`（单段内任意）、`?`（单字符）。
// 模式与路径一律以 / 为分隔符、相对工作区根。
export function globToRegex(pattern) {
  const p = pattern.replaceAll('\\', '/')
  let re = ''
  let i = 0
  while (i < p.length) {
    const c = p[i]
    if (c === '*') {
      let j = i
      while (p[j] === '*') j++
      if (j - i >= 2) {
        if (p[j] === '/') {
          re += '(?:[^/]*/)*'
          i = j + 1
        } else {
          re += '.*'
          i = j
        }
      } else {
        re += '[^/]*'
        i++
      }
    } else if (c === '?') {
      re += '[^/]'
      i++
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
      i++
    }
  }
  return new RegExp(`^${re}$`)
}

export function matchGlob(pattern, relPath) {
  return globToRegex(pattern).test(relPath)
}

export function hasMagic(pattern) {
  return /[*?]/.test(pattern)
}
