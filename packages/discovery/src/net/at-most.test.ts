import { expect, test } from 'vitest'
import { Bound, mapAtMost } from './at-most'

function gated() {
  const order: number[] = []
  const state = { running: 0, most: 0, order }
  const opens: (() => void)[] = []
  const fn = async (n: number) => {
    state.most = Math.max(state.most, ++state.running)
    await new Promise<void>((resolve) => opens.push(resolve))
    state.running--
    state.order.push(n)
    if (n < 0) {
      throw new Error(`failed ${n}`)
    }
    return n * 10
  }
  return { state, fn, openLast: () => opens.pop()?.(), openFirst: () => opens.shift()?.() }
}

const turn = () => new Promise((resolve) => setImmediate(resolve))

test('the results keep the items order whatever order the tasks end in, and no more than the limit run', async () => {
  const { state, fn, openLast } = gated()
  const done = mapAtMost([1, 2, 3, 4, 5, 6], 4, fn)
  for (let k = 0; k < 6; k++) {
    await turn()
    openLast()
  }
  expect(await done).toEqual([10, 20, 30, 40, 50, 60])
  expect(state.most).toBe(4)
  expect(state.order).not.toEqual([1, 2, 3, 4, 5, 6])
})

test('after a failure no task starts and the earliest failure is thrown', async () => {
  const { state, fn, openFirst, openLast } = gated()
  const done = mapAtMost([1, -2, -3, 4, 5], 3, fn)
  const thrown = expect(done).rejects.toThrow('failed -2')
  await turn()
  openLast()
  await turn()
  openFirst()
  await turn()
  openFirst()
  await thrown
  expect([...state.order].sort()).toEqual([-2, -3, 1])
})

test('no item gives no result', async () => {
  expect(await mapAtMost([], 4, () => Promise.resolve(1))).toEqual([])
})

test('a bound runs at most its limit at once, the others in the order they asked, a failure freeing its slot', async () => {
  const bound = new Bound(2)
  const opens: (() => void)[] = []
  const started: number[] = []
  const task = (n: number) => () =>
    new Promise<number>((resolve, reject) => {
      started.push(n)
      opens.push(() => (n === 1 ? reject(new Error('failed')) : resolve(n)))
    })
  const runs = [1, 2, 3, 4].map((n) => bound.run(task(n)))
  const firstFailure = expect(runs[0]).rejects.toThrow('failed')
  await turn()
  expect(started).toEqual([1, 2])
  opens.shift()?.()
  await firstFailure
  await turn()
  expect(started).toEqual([1, 2, 3])
  for (let k = 0; k < 3; k++) {
    opens.shift()?.()
    await turn()
  }
  expect(await Promise.all(runs.slice(1))).toEqual([2, 3, 4])
})
