import { useState } from 'react'
import { SkButton } from '@skelloapp/skello-ds-web'

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
  return <SkButton variant="outlined" size="small" onClick={() => { void copy() }}>{label}</SkButton>
}
