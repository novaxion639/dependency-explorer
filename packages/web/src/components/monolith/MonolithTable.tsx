import { useState } from 'react'
import type { MonolithRow } from '../../diagram/layouts/monolith'
import styles from './MonolithTable.module.css'

type Measure = 'files' | 'routes' | 'tables'
const COLUMNS: Array<{ key: Measure; label: string }> = [{ key: 'files', label: 'Files' }, { key: 'routes', label: 'Routes' }, { key: 'tables', label: 'Tables' }]

function Row({ row, max, onOpenArea }: { row: MonolithRow; max: (key: Measure) => number; onOpenArea: (id: string) => void }) {
  const id = row.areaId
  return (
    <tr data-unmapped={id === null ? 'true' : 'false'}>
      <th scope="row">{id ? <button type="button" onClick={() => onOpenArea(id)}>{row.name}</button> : row.name}</th>
      {COLUMNS.map(c => (
        <td key={c.key}>
          <span className={styles.bar} style={{ width: `${(row[c.key] / max(c.key)) * 100}%` }} aria-hidden="true" />
          <span className={styles.value}>{row[c.key]}</span>
        </td>
      ))}
    </tr>
  )
}

export function MonolithTable({ rows, onOpenArea }: { rows: MonolithRow[]; onOpenArea: (id: string) => void }) {
  const [sort, setSort] = useState<Measure>('files')
  const mapped = rows.filter(r => r.areaId !== null).sort((a, b) => b[sort] - a[sort] || a.name.localeCompare(b.name))
  const max = (key: Measure) => Math.max(1, ...rows.map(r => r[key]))
  return (
    <table className={styles.table} aria-label="skello-app by product area">
      <thead>
        <tr>
          <th scope="col">Product area</th>
          {COLUMNS.map(c => (
            <th key={c.key} scope="col" aria-sort={sort === c.key ? 'descending' : 'none'}>
              <button type="button" onClick={() => setSort(c.key)}>{c.label}</button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...mapped, ...rows.filter(r => r.areaId === null)].map(row => <Row key={row.name} row={row} max={max} onOpenArea={onOpenArea} />)}
      </tbody>
    </table>
  )
}
