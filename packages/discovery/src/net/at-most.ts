export async function mapAtMost<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  const failures = new Map<number, unknown>()
  const entries = items.entries()
  const lane = async () => {
    while (failures.size === 0) {
      const step = entries.next()
      if (step.done) {
        return
      }
      const [index, item] = step.value
      try {
        out[index] = await fn(item)
      } catch (e) {
        failures.set(index, e)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane))
  if (failures.size > 0) {
    throw failures.get(Math.min(...failures.keys()))
  }
  return out
}

export class Bound {
  #free: number
  readonly #waiting: (() => void)[] = []

  constructor(limit: number) {
    this.#free = limit
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.#free > 0) {
      this.#free--
    } else {
      await new Promise<void>((resolve) => this.#waiting.push(resolve))
    }
    try {
      return await task()
    } finally {
      const next = this.#waiting.shift()
      if (next) {
        next()
      } else {
        this.#free++
      }
    }
  }
}
