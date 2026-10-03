import { useState } from 'react'

export function CopyMermaid({ source }: { source: string }) {
  const [status, setStatus] = useState<{ source: string; ok: boolean } | null>(null)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(source)
      setStatus({ source, ok: true })
    } catch {
      setStatus({ source, ok: false })
    }
  }
  const label = !status || status.source !== source ? 'Copy Mermaid' : status.ok ? 'Copied' : 'Copy failed'
  return <button type="button" onClick={() => { void copy() }}>{label}</button>
}
