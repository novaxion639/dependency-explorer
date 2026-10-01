const REGEX_META = /[.+^${}()|[\]\\]/g

export function globToRegExp(glob: string): RegExp {
  let source = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob.charAt(i)
    if (c === '*' && glob.charAt(i + 1) === '*') {
      const slash = glob.charAt(i + 2) === '/'
      source += slash ? '(?:.*/)?' : '.*'
      i += slash ? 2 : 1
    } else if (c === '*') {
      source += '[^/]*'
    } else if (c === '?') {
      source += '[^/]'
    } else {
      source += c.replace(REGEX_META, '\\$&')
    }
  }
  return new RegExp(`^${source}$`)
}
