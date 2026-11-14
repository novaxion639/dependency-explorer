import { useEffect } from 'react'
import { keyInfo, presentStepKey, stepThrough } from './presentMode'

export function usePresentSteps(enabled: boolean, steps: readonly string[], current: string | null, onStep: (next: string | null) => void) {
  useEffect(() => {
    if (!enabled) {
      return
    }
    const onKey = (e: KeyboardEvent) => {
      const dir = presentStepKey(keyInfo(e))
      if (dir) {
        e.preventDefault()
        onStep(stepThrough(steps, current, dir))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, steps, current, onStep])
}
