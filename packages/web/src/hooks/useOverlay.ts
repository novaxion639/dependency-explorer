import { useEffect, useRef, useState } from 'react'

interface Schema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: { issues: unknown[] } }
}

interface Load {
  raw: unknown
  settled: boolean
  warned: boolean
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
    settled: false,
    warned: false,
    promise: readOverlay(name, fetchImpl).then(raw => {
      load.raw = raw
      load.settled = true
      return raw
    }),
  }
  byName.set(name, load)
  return load
}

function parseOverlay<T>(name: string, schema: Schema<T>, load: Load): T | null {
  if (load.raw === null) {
    return null
  }
  const parsed = schema.safeParse(load.raw)
  if (!parsed.success) {
    if (!load.warned) {
      load.warned = true
      console.error(`${name} overlay ignored: it fails its schema`, parsed.error.issues)
    }
    return null
  }
  return parsed.data
}

export function useOverlay<T>(name: string, schema: Schema<T>, fetchImpl: typeof fetch = fetch): T | null {
  const known = loads.get(fetchImpl)?.get(name)
  const parsedAtMount = useRef(known?.settled ? known : null)
  const [overlay, setOverlay] = useState(() => (known?.settled ? parseOverlay(name, schema, known) : null))
  useEffect(() => {
    let live = true
    const load = loadOnce(name, fetchImpl)
    void load.promise.then(() => {
      if (live && load !== parsedAtMount.current) {
        setOverlay(parseOverlay(name, schema, load))
      }
    })
    return () => {
      live = false
    }
  }, [name, schema, fetchImpl])
  return overlay
}
