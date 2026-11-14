// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Sparkline } from './Sparkline'

const renderSpark = (partialNote: string | null, values: (number | null)[] = [1, null, 3, 2]) => {
  render(<Sparkline label="Count" values={values} partialNote={partialNote} />)
  return screen.getByRole('img', { name: /^Count/ })
}

const pointsPerLine = (spark: HTMLElement) => [...spark.querySelectorAll('polyline')].map(p => p.getAttribute('points')?.split(' ').length)

describe('Sparkline', () => {
  it('names its figures without a partial note', () => {
    const spark = renderSpark(null)

    expect(spark.getAttribute('aria-label')).toBe('Count, max 3, last 2')
  })

  it('draws every point on the line without a partial note', () => {
    const spark = renderSpark(null)

    expect(pointsPerLine(spark)).toEqual([1, 2])
    expect(spark.querySelectorAll('circle')).toHaveLength(0)
  })

  it('names the absence of data when every value is null', () => {
    const spark = renderSpark(null, [null, null])

    expect(spark.getAttribute('aria-label')).toMatch(/^Count, no data/)
  })

  it('names the partial note', () => {
    const spark = renderSpark('the last point is partial')

    expect(spark.getAttribute('aria-label')).toBe('Count, max 3, last 2; the last point is partial')
  })

  it('draws the last point hollow, off the line, with a partial note', () => {
    const spark = renderSpark('the last point is partial')

    expect(pointsPerLine(spark)).toEqual([1, 1])
    expect(spark.querySelectorAll('circle')).toHaveLength(1)
  })
})
