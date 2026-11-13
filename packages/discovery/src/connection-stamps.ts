import type { ServiceConnection } from '@dependency-explorer/schema'

type Channel = Pick<ServiceConnection, 'from' | 'to' | 'protocol'>

export const channelKey = (c: Channel): string => `${c.from}→${c.to}:${c.protocol}`

export function stampKeyOf(connections: Channel[], from: string, to: string, transport: string): string | null {
  const channels = connections.filter(c => c.from === from && c.to === to)
  const wanted = transport.split(' ')[0]
  const match = channels.find(c => c.protocol === wanted) ?? channels.find(c => wanted === 'cdc' && c.protocol === 'kinesis')
  const channel = match ?? (channels.length === 1 ? channels[0] : undefined)
  return channel === undefined ? null : channelKey(channel)
}
