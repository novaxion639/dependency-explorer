// @vitest-environment jsdom
import { beforeAll, describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { parseUrl } from '../../hooks/useUrlState'
import { validateUrlState } from '../../shell/validateUrlState'
import { renderInApp } from '../../test/renderInApp'
import { FlowPage } from './FlowPage'
import { flowDataset, shiftCreationFlow } from '../../test/flowFixtures'

const PRESENT = '?page=flows&flow=shift-creation&present=1&renderer=svg'
const renderAt = (qs: string, patch: () => void) => renderInApp(<FlowPage map={flowDataset.map} flow={shiftCreationFlow} url={validateUrlState(parseUrl(qs))} patch={patch} onBack={() => {}} />, qs)

describe('FlowPage stepping', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('steps the story with the arrow keys from no chapter to the first', async () => {
    const patch = vi.fn()
    renderAt(PRESENT, patch)

    await userEvent.keyboard('{ArrowRight}')

    expect(patch).toHaveBeenCalledWith({ chapter: 1 })
  })

  it('steps the story from the last chapter back to the first', async () => {
    const patch = vi.fn()
    renderAt(`${PRESENT}&chapter=${shiftCreationFlow.chapters.length}`, patch)

    await userEvent.keyboard('{ArrowRight}')

    expect(patch).toHaveBeenCalledWith({ chapter: 1 })
  })
})
