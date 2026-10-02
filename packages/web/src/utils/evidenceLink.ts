const GITHUB_ORG = 'https://github.com/skelloapp'
const CONFIG_EVIDENCE = new Set(['serverless', 'terraform'])

export function evidenceHref(evidence: string, pins: Record<string, string>): string | undefined {
  const [repo = '', ...rest] = evidence.split(':')
  const location = rest.join(':')
  const sha = pins[repo]
  if (!sha) {
    return undefined
  }
  return CONFIG_EVIDENCE.has(location) ? `${GITHUB_ORG}/${repo}/tree/${sha}` : `${GITHUB_ORG}/${repo}/blob/${sha}/${location}`
}
