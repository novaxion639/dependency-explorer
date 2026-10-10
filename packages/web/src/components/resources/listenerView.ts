import type { Listener, ListenerEffect, WriteEvent } from '@dependency-explorer/data'
import type { UrlState } from '../../hooks/useUrlState'
import { evidenceHref } from '../../utils/evidenceLink'

export type ListenerUrl = Pick<UrlState, 'event' | 'listener' | 'lev' | 'lkind' | 'lgrade'>
export const LISTENER_EVENTS: readonly WriteEvent[] = ['create', 'update', 'destroy']
export const LISTENER_KINDS: ReadonlyArray<Listener['kind']> = ['callback', 'cascade', 'touch', 'gem']
export const LISTENER_GRADES: readonly string[] = ['verified', 'text']
export const EFFECT_BADGE: Record<ListenerEffect['grade'], string> = { graph: '✓', constant: '✓', text: '~' }

const hasText = (l: Listener) => l.effects.some(e => e.grade === 'text')

export function filterListeners(listeners: Listener[], f: Pick<ListenerUrl, 'lev' | 'lkind' | 'lgrade'>): Listener[] {
  return listeners.filter(l => (f.lev === null || l.events.some(e => e === f.lev)) && (f.lkind === null || l.kind === f.lkind) && (f.lgrade === null || (f.lgrade === 'text') === hasText(l)))
}

export function tableName(id: string): string {
  return id.split('.').pop() ?? id
}

export function effectText(e: ListenerEffect): string {
  const tail = `${e.mode === 'async-job' ? ' · async' : ''}${e.via ? ` · via ${e.via}` : ''}`
  if (e.kind === 'writes') {
    return `writes ${tableName(e.target)} · runs ${e.runs ?? 'all'} · ${(e.events ?? []).join(' ')}${tail}`
  }
  return `${e.kind} ${e.target}${tail}`
}

export function sourceHref(at: { file: string; line: number }, pins: Record<string, string>): string | undefined {
  const href = evidenceHref(`skello-app:${at.file}`, pins)
  return href ? `${href}#L${at.line}` : undefined
}
