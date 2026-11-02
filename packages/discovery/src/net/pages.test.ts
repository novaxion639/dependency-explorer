import { expect, test } from 'vitest'
import { readPages, type Page } from './pages'

function numbered(count: number) {
  const asked: number[] = []
  const read = (n: number): Promise<Page<number, number>> => {
    asked.push(n)
    return Promise.resolve({ items: [n], next: n + 1 < count ? n + 1 : null })
  }
  return { read, asked }
}

test('pages are read in turn until one names no next page', async () => {
  const { read, asked } = numbered(3)
  expect(await readPages(0, read)).toEqual({ items: [0, 1, 2], unread: false })
  expect(asked).toEqual([0, 1, 2])
})

test('a single page is read once', async () => {
  const { read, asked } = numbered(1)
  expect(await readPages(0, read)).toEqual({ items: [0], unread: false })
  expect(asked).toEqual([0])
})

test('the cap stops the reading and says a page was left', async () => {
  const { read, asked } = numbered(6)
  expect(await readPages(0, read, 4)).toEqual({ items: [0, 1, 2, 3], unread: true })
  expect(asked).toEqual([0, 1, 2, 3])
})

test('a last page that lands on the cap leaves nothing unread', async () => {
  const { read } = numbered(4)
  expect(await readPages(0, read, 4)).toEqual({ items: [0, 1, 2, 3], unread: false })
})

test('a failed page fails the reading', async () => {
  const boom = new Error('boom')
  const read = (n: number): Promise<Page<number, number>> => (n ? Promise.reject(boom) : Promise.resolve({ items: [n], next: 1 }))
  await expect(readPages(0, read)).rejects.toBe(boom)
})
