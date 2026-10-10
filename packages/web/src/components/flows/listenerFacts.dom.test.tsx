// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { connectivityMap } from '@dependency-explorer/data'
import { ListenerFacts } from './ListenerFacts'

const flowOf = (id: string) => connectivityMap.flows.find(f => f.id === id)

function mount(id: string, onOpenResource: (id: string) => void = () => {}, flowId = 'shift-update') {
  const host = document.createElement('div')
  const flow = flowOf(flowId)
  const u = (flow?.codeUnits ?? []).find(x => x.id === id)
  act(() => {
    createRoot(host).render(flow && u ? <ListenerFacts flow={flow} unit={u} onOpenResource={onOpenResource} /> : null)
  })
  return host
}

const headings = (host: HTMLElement) => [...host.querySelectorAll('h3')].map(h => h.textContent)

describe('ListenerFacts', () => {
  it('shows what the update service’s shift write fires', () => {
    const host = mount('cu-upd-service')
    expect(headings(host)).toContain('Fires')
    expect(host.textContent).toContain('update_paid_leaves')
  })
  it('marks a text-graded write site unverified and opens the table', () => {
    const opened: string[] = []
    const host = mount('cu-upd-service', id => opened.push(id))
    expect(host.querySelector('[role="img"][aria-label^="unverified"]')).not.toBeNull()
    const button = [...host.querySelectorAll('button')].find(b => b.textContent === 'shifts')
    act(() => button?.click())
    expect(opened).toHaveLength(1)
    expect(opened[0]).toMatch(/shifts$/)
  })
  it('lists the derived listeners and the drift on the callback unit', () => {
    const host = mount('cu-upd-callbacks')
    expect(headings(host)).toContain('Derived listeners')
    expect(host.textContent).toContain('⚠ missing')
    expect(host.textContent).toContain('⚠ unsupported')
    expect(host.textContent).toContain('app/jobs/shifts/shift_data_updater_job.rb')
  })
  it('shows the cascade reached through the shifts listeners', () => {
    const host = mount('cu-upd-service')
    const fires = host.querySelector('section')
    const reached = [...(fires?.querySelectorAll('ul ul button') ?? [])].map(b => b.textContent)
    expect(reached).toContain('paid_leaves_counters')
  })
  it('reads runs none with the call for a write that skips every listener', () => {
    const host = mount('cu-upd-service')
    expect(host.textContent).toContain('runs none (update_all)')
  })
  it('labels a table-event link unverified', () => {
    const host = mount('cu-ss-prospect', () => {}, 'self-serve-signup')
    expect(host.textContent).toContain('by table event — unverified')
  })
  it('renders nothing for a unit with no writes and no callbacks', () => {
    const host = mount('cu-upd-controller')
    expect(host.querySelector('h3')).toBeNull()
  })
})
