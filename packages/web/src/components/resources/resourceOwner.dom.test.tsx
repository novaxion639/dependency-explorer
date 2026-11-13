// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ResourcePage } from './ResourcePage'

const noop = () => {}

function mount(id: string) {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div')
  act(() => {
    createRoot(host).render(<ResourcePage id={id} onOpenResource={noop} onOpenFile={noop} onOpenFlow={noop} onSelectService={noop} onBlast={noop} listeners={{ event: null, listener: null, lev: null, lkind: null, lgrade: null }} onListeners={noop} />)
  })
  return host
}

const button = (host: HTMLElement, name: string) => [...host.querySelectorAll('button')].find(b => b.textContent === name) ?? null

describe('ResourcePage owner', () => {
  it('links an owner the map holds', () => {
    expect(button(mount('pg:skello_production.shifts'), 'skello-app')).not.toBeNull()
  })

  it('names an owner the map does not hold without linking to it', () => {
    const host = mount('ddb:svcDocuments-eSignature-V2')
    expect(button(host, 'svc-documents-esignature')).toBeNull()
    expect(host.textContent).toContain('owned by svc-documents-esignature (not in the map)')
  })
})
