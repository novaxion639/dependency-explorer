import type { FlowFailure, AuthRef } from '@dependency-explorer/data'

/**
 * The expressiveness badge cluster a code edge can carry — 📜 contracts,
 * 🔑 auth, 🧬 PII, 🛡/⚠ failure. Shared by ConnectivityEdge and
 * FloatingDbEdge so infra-targeting edges render the same facts as
 * service-targeting ones.
 */
export interface EdgeBadgeData {
  failure?: FlowFailure
  auth?: AuthRef
  pii?: string[]
  contractRefs?: string[]
  [key: string]: unknown
}

export function EdgeBadges({ data }: { data?: EdgeBadgeData }) {
  if (!data) return null
  const { failure, auth, pii, contractRefs } = data
  return (
    <>
      {(contractRefs?.length ?? 0) > 0 && (
        <span
          title={`spec-verified contracts:\n${contractRefs!.join('\n')}`}
          style={{
            fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
            whiteSpace: 'nowrap', pointerEvents: 'all',
            background: '#8b5cf616', border: '1px solid #8b5cf644', color: '#8b5cf6',
          }}
        >
          📜 {contractRefs!.length === 1 ? contractRefs![0] : `${contractRefs!.length} contracts`}
        </span>
      )}
      {(pii?.length ?? 0) > 0 && (
        <span
          title={`payload carries PII: ${pii!.join(', ')} (lib-anonymizer decorator-typed)`}
          style={{
            fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
            whiteSpace: 'nowrap', pointerEvents: 'all',
            background: '#ec489916', border: '1px solid #ec489944', color: '#ec4899',
          }}
        >
          🧬 PII×{pii!.length}
        </span>
      )}
      {auth && (auth.tokenType || auth.gate || auth.authorizer) && (
        <span
          title={[
            auth.tokenType ? `token: ${auth.tokenType}` : null,
            auth.gate ? `gate: ${auth.gate}` : null,
            auth.authorizer ? `authorizer: ${auth.authorizer}` : null,
            auth.authAbsent ? 'no gateway authorizer — auth enforced in-lambda' : null,
          ].filter(Boolean).join('\n')}
          style={{
            fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
            whiteSpace: 'nowrap', pointerEvents: 'all',
            background: '#4f6ef716', border: '1px solid #4f6ef744', color: '#4f6ef7',
          }}
        >
          🔑 {auth.gate ?? auth.tokenType}
        </span>
      )}
      {failure && (failure.dlq || failure.dlqAbsent) && (
        <span
          title={failure.dlq
            ? `DLQ: ${failure.dlq}${failure.retryPolicy ? ` — ${failure.retryPolicy}` : ''}${failure.onError ? `\n${failure.onError}` : ''}`
            : `No DLQ on this hop (confirmed)${failure.onError ? `\n${failure.onError}` : ''}`}
          style={{
            fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
            whiteSpace: 'nowrap', pointerEvents: 'all',
            background: failure.dlq ? '#10b98122' : '#ef444422',
            border: `1px solid ${failure.dlq ? '#10b98144' : '#ef444444'}`,
            color: failure.dlq ? '#10b981' : '#ef4444',
          }}
        >
          {failure.dlq ? `🛡 ${failure.dlq}` : '⚠ no DLQ'}
        </span>
      )}
    </>
  )
}
