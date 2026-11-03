import styles from './Sparkline.module.css'

interface Props {
  label: string
  values: Array<number | null>
  partialLast: boolean
}

const SPARK = { width: 140, height: 28 }

export function Sparkline({ label, values, partialLast }: Props) {
  const known = values.filter(v => v !== null)
  const max = Math.max(1, ...known)
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * SPARK.width
  const y = (v: number) => SPARK.height - (v / max) * SPARK.height
  const runs = (partialLast ? values.slice(0, -1) : values).reduce<string[][]>((acc, v, i) => {
    if (v === null) {
      acc.push([])
    } else {
      acc.at(-1)?.push(`${x(i)},${y(v)}`)
    }
    return acc
  }, [[]]).filter(run => run.length > 0)
  const partialPoint = partialLast ? values.at(-1) : null
  const partialNote = partialLast ? '; the last point is the snapshot day, partial' : ''
  const name = known.length === 0
    ? `${label}, no data`
    : `${label}, max ${Math.round(Math.max(...known))}, last ${Math.round(known.at(-1) ?? 0)}${partialNote}`
  return (
    <figure className={styles.spark}>
      <figcaption>{label}</figcaption>
      <svg role="img" aria-label={name} width={SPARK.width} height={SPARK.height} viewBox={`0 0 ${SPARK.width} ${SPARK.height}`}>
        {runs.map(run => <polyline key={run[0]} points={run.join(' ')} />)}
        {typeof partialPoint === 'number' && <circle cx={x(values.length - 1)} cy={y(partialPoint)} r={2.5} />}
      </svg>
    </figure>
  )
}
