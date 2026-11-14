// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithNav } from '../../test/renderWithNav'
import { ResourcePage } from './ResourcePage'

const noop = () => {}
const NO_LISTENERS = { event: null, listener: null, lev: null, lkind: null, lgrade: null }
const mount = (id: string) => renderWithNav(<ResourcePage id={id} onOpenResource={noop} onOpenFlow={noop} onBlast={noop} listeners={NO_LISTENERS} onListeners={noop} />)

describe('ResourcePage owner', () => {
  it('links an owner the map holds', () => {
    mount('pg:skello_production.shifts')

    expect(screen.getAllByRole('link', { name: 'skello-app' }).map(l => l.getAttribute('href'))).toContain('/?page=monolith&s=skello-app')
  })

  it('names an owner the map does not hold', () => {
    mount('ddb:svcDocuments-eSignature-V2')

    expect(screen.getByText('owned by svc-documents-esignature (not in the map)', { exact: false })).toBeTruthy()
  })

  it('does not link an owner the map does not hold', () => {
    mount('ddb:svcDocuments-eSignature-V2')

    expect(screen.queryByRole('link', { name: 'svc-documents-esignature' })).toBeNull()
  })
})
