import styles from './Sparkline.module.css'

interface Props {
  label: string
  values: Array<number | null>
  partialNote: string | null
}

const SPARK = { width: 140, height: 28 }

export function Sparkline({ label, values, partialNote }: Props) {
  const known = values.filter(v => v !== null)
  const max = Math.max(1, ...known)
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * SPARK.width
  const y = (v: number) => SPARK.height - (v / max) * SPARK.height
  const runs = (partialNote === null ? values : values.slice(0, -1)).reduce<string[][]>((acc, v, i) => {
    if (v === null) {
      acc.push([])
    } else {
      acc.at(-1)?.push(`${x(i)},${y(v)}`)
    }
    return acc
  }, [[]]).filter(run => run.length > 0)
  const partialPoint = partialNote === null ? null : values.at(-1)
  const note = partialNote === null ? '' : `; ${partialNote}`
  const name = known.length === 0
    ? `${label}, no data`
    : `${label}, max ${Math.round(Math.max(...known))}, last ${Math.round(known.at(-1) ?? 0)}${note}`
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
