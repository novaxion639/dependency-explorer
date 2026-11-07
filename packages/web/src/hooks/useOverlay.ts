import { useEffect, useState } from 'react'

interface Schema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: { issues: unknown[] } }
}

interface Load {
  raw: unknown
  promise: Promise<unknown>
}

const loads = new WeakMap<typeof fetch, Map<string, Load>>()

async function readOverlay(name: string, fetchImpl: typeof fetch): Promise<unknown> {
  try {
    const response = await fetchImpl(`${import.meta.env.BASE_URL}overlay/${name}.json`)
    return response.ok ? await response.json() : null
  } catch {
    return null
  }
}

function loadOnce(name: string, fetchImpl: typeof fetch): Load {
  const byName = loads.get(fetchImpl) ?? new Map<string, Load>()
  loads.set(fetchImpl, byName)
  const known = byName.get(name)
  if (known) {
    return known
  }
  const load: Load = {
    raw: null,
    promise: readOverlay(name, fetchImpl).then(raw => {
      load.raw = raw
      return raw
    }),
  }
  byName.set(name, load)
  return load
}

function parseOverlay<T>(name: string, schema: Schema<T>, raw: unknown): T | null {
  if (raw === null) {
    return null
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    console.error(`${name} overlay ignored: it fails its schema`, parsed.error.issues)
    return null
  }
  return parsed.data
}

export function useOverlay<T>(name: string, schema: Schema<T>, fetchImpl: typeof fetch = fetch): T | null {
  const [overlay, setOverlay] = useState(() => parseOverlay(name, schema, loads.get(fetchImpl)?.get(name)?.raw ?? null))
  useEffect(() => {
    let live = true
    void loadOnce(name, fetchImpl).promise.then(raw => {
      if (live) {
        setOverlay(parseOverlay(name, schema, raw))
      }
    })
    return () => {
      live = false
    }
  }, [name, schema, fetchImpl])
  return overlay
}
