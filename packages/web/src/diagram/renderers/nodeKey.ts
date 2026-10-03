export function enteredNodeId(key: string, target: EventTarget | null): string | null {
  if (key !== 'Enter' || !(target instanceof Element)) {
    return null
  }
  return target.closest('.react-flow__node')?.getAttribute('data-id') ?? null
}
