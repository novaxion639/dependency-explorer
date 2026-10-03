export function enteredNodeId(key: string, target: EventTarget | null): string | null {
  if (key !== 'Enter' || !(target instanceof Element) || !target.classList.contains('react-flow__node')) {
    return null
  }
  return target.getAttribute('data-id')
}
