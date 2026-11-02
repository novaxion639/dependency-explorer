export type Page<P, T> = { items: T[]; next: P | null }

export async function readPages<P, T>(
  first: P,
  read: (page: P) => Promise<Page<P, T>>,
  max = Number.POSITIVE_INFINITY,
): Promise<{ items: T[]; unread: boolean }> {
  const items: T[] = []
  let page: P | null = first
  for (let n = 0; page !== null && n < max; n++) {
    const answer: Page<P, T> = await read(page)
    items.push(...answer.items)
    page = answer.next
  }
  return { items, unread: page !== null }
}
