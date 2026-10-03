import { readRootToken } from '../tokens'

let renders = 0

export async function renderMermaid(source: string): Promise<string> {
  const { default: mermaid } = await import('mermaid')
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    look: 'classic',
    layout: 'dagre',
    htmlLabels: false,
    flowchart: { wrappingWidth: 280 },
    themeVariables: {
      fontFamily: readRootToken('--font-sans'),
      primaryColor: readRootToken('--card'),
      primaryTextColor: readRootToken('--ink'),
      primaryBorderColor: readRootToken('--ink'),
      lineColor: readRootToken('--ink'),
      clusterBkg: readRootToken('--paper-2'),
      clusterBorder: readRootToken('--rule-strong'),
      edgeLabelBackground: readRootToken('--card'),
    },
  })
  renders += 1
  const { svg } = await mermaid.render(`mermaid-diagram-${renders}`, source)
  return svg
}
