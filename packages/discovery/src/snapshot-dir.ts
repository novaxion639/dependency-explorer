import * as fs from 'node:fs'
import * as path from 'node:path'
import { z } from 'zod'

export class SnapshotFormatError extends Error {}

const causeOf = (e: unknown): string => (e instanceof Error ? e.message : String(e))

export function snapshotFolder<S extends z.ZodObject>(opts: { schema: S; label: string; fetchScript: string }) {
  const keys = Object.keys(opts.schema.shape)
  const files = new Set(keys.map((key) => `${key}.json`))
  const reFetch = `Re-run \`pnpm ${opts.fetchScript}\` for a fresh snapshot.`
  const holdsOnlySnapshotFiles = (dir: string): boolean =>
    fs.readdirSync(dir, { withFileTypes: true }).every((entry) => entry.isFile() && files.has(entry.name))
  const readFile = (file: string): unknown => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (e) {
      throw new SnapshotFormatError(`${file} cannot be read: ${causeOf(e)}\n${reFetch}`)
    }
  }
  return {
    write(dir: string, snapshot: Record<string, unknown>): void {
      if (fs.existsSync(dir) && !holdsOnlySnapshotFiles(dir)) {
        throw new Error(`${dir} holds files other than a ${opts.label} snapshot; nothing written`)
      }
      const parent = path.dirname(dir)
      fs.mkdirSync(parent, { recursive: true })
      const temp = fs.mkdtempSync(path.join(parent, `.${path.basename(dir)}-`))
      try {
        for (const key of keys) {
          fs.writeFileSync(path.join(temp, `${key}.json`), JSON.stringify(snapshot[key], null, 1))
        }
        fs.rmSync(dir, { recursive: true, force: true })
        fs.renameSync(temp, dir)
      } catch (e) {
        fs.rmSync(temp, { recursive: true, force: true })
        throw e
      }
    },
    read(dir: string): z.infer<S> {
      const parsed = opts.schema.safeParse(Object.fromEntries(keys.map((key) => [key, readFile(path.join(dir, `${key}.json`))])))
      if (!parsed.success) {
        const file = path.join(dir, `${String(parsed.error.issues[0]?.path[0])}.json`)
        throw new SnapshotFormatError(`${file} does not match the ${opts.label} snapshot format: ${z.prettifyError(parsed.error)}\n${reFetch}`)
      }
      return parsed.data
    },
  }
}
