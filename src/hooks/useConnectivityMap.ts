import { useCallback, useEffect, useState } from 'react'
import { ConnectivityMapSchema } from '../data/schemas'
import type { ConnectivityMap } from '../data/schemas'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; map: ConnectivityMap }

export function useConnectivityMap(): State & { reload: () => void } {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    setState({ status: 'loading' })
    fetch('/api/map')
      .then(res => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`)
        return res.json()
      })
      .then(data => {
        const map = ConnectivityMapSchema.parse(data)
        setState({ status: 'ok', map })
      })
      .catch(err => {
        setState({ status: 'error', message: err.message })
      })
  }, [tick])

  const reload = useCallback(() => setTick(t => t + 1), [])

  return { ...state, reload }
}
