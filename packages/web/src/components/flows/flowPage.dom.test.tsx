// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { connectivityMap } from '@dependency-explorer/data'
import { parseUrl, type UrlState } from '../../hooks/useUrlState'
import { validateUrlState } from '../../shell/validateUrlState'
import { FlowPage } from './FlowPage'

const shift = connectivityMap.flows.find(f => f.id === 'shift-creation')
if (!shift) {
  throw new Error('shift-creation missing')
}

describe('FlowPage stepping', () => {
  it('steps the story with the arrow keys, from no chapter to the first and from the last back to the first', async () => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    Element.prototype.scrollIntoView = () => {}
    const patches: Array<Partial<UrlState>> = []
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const render = (qs: string) => root.render(<FlowPage flow={shift} url={validateUrlState(parseUrl(qs))} patch={p => patches.push(p)} onBack={() => {}} />)
    const press = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key }))
    await act(async () => render('?page=flows&flow=shift-creation&present=1&renderer=svg'))
    await act(async () => press('ArrowRight'))
    await act(async () => render(`?page=flows&flow=shift-creation&present=1&renderer=svg&chapter=${shift.chapters?.length ?? 0}`))
    await act(async () => press('ArrowRight'))
    expect(patches).toEqual([{ chapter: 1 }, { chapter: 1 }])
    root.unmount()
  })
})
