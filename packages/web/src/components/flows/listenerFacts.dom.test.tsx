// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { connectivityMap } from '@dependency-explorer/data'
import { ListenerFacts } from './ListenerFacts'

const flow = connectivityMap.flows.find(f => f.id === 'shift-update')
const unit = (id: string) => (flow?.codeUnits ?? []).find(u => u.id === id)

function mount(id: string, onOpenResource: (id: string) => void = () => {}) {
  const host = document.createElement('div')
  const u = unit(id)
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
  it('renders nothing for a unit with no writes and no callbacks', () => {
    const other = (flow?.codeUnits ?? []).find(u => u.kind === 'controller')
    const host = document.createElement('div')
    act(() => {
      createRoot(host).render(flow && other ? <ListenerFacts flow={flow} unit={other} onOpenResource={() => {}} /> : null)
    })
    expect(host.querySelector('h3')).toBeNull()
  })
})
