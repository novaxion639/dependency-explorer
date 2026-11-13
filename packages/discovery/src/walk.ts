import * as fs from 'node:fs'
import * as path from 'node:path'

export function walkTree(dir: string, skip: (entry: fs.Dirent) => boolean, keep: (entry: fs.Dirent, full: string) => boolean, out: string[] = []): string[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (skip(entry)) {
      continue
    }
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkTree(full, skip, keep, out)
    } else if (keep(entry, full)) {
      out.push(full)
    }
  }
  return out
}
