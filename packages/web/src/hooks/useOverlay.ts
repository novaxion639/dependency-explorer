import { useEffect, useState } from 'react'
import { DatadogOverlaySchema, type DatadogOverlay } from '@dependency-explorer/data'

interface Load {
  value: DatadogOverlay | null
  promise: Promise<DatadogOverlay | null>
}

const loads = new WeakMap<typeof fetch, Load>()

async function readOverlay(fetchImpl: typeof fetch): Promise<DatadogOverlay | null> {
  try {
    const response = await fetchImpl(`${import.meta.env.BASE_URL}overlay/datadog.json`)
    if (!response.ok) {
      return null
    }
    const parsed = DatadogOverlaySchema.safeParse(await response.json())
    if (!parsed.success) {
      console.error('Datadog overlay ignored: it fails DatadogOverlaySchema', parsed.error.issues)
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}

function loadOnce(fetchImpl: typeof fetch): Load {
  const known = loads.get(fetchImpl)
  if (known) {
    return known
  }
  const load: Load = {
    value: null,
    promise: readOverlay(fetchImpl).then(value => {
      load.value = value
      return value
    }),
  }
  loads.set(fetchImpl, load)
  return load
}

export function useOverlay(fetchImpl: typeof fetch = fetch): DatadogOverlay | null {
  const [overlay, setOverlay] = useState(() => loads.get(fetchImpl)?.value ?? null)
  useEffect(() => {
    let live = true
    void loadOnce(fetchImpl).promise.then(value => {
      if (live) {
        setOverlay(value)
      }
    })
    return () => {
      live = false
    }
  }, [fetchImpl])
  return overlay
}
