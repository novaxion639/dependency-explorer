import { useState } from 'react'
import { SkButton, SkSimpleTable, SkSimpleTableBody, SkSimpleTableCell, SkSimpleTableHead, SkSimpleTableRow } from '@skelloapp/skello-ds-web'
import type { MonolithRow } from '../../diagram/layouts/monolith'
import { NavLink } from '../../shell/NavLink'
import styles from './MonolithTable.module.css'

type Measure = 'files' | 'routes' | 'tables'
const COLUMNS: Array<{ key: Measure; label: string }> = [{ key: 'files', label: 'Files' }, { key: 'routes', label: 'Routes' }, { key: 'tables', label: 'Tables' }]

function Row({ row, max }: { row: MonolithRow; max: (key: Measure) => number }) {
  const id = row.areaId
  return (
    <SkSimpleTableRow data-unmapped={id === null ? 'true' : 'false'}>
      <SkSimpleTableCell component="th" scope="row" className={styles.name}>
        {id ? <NavLink patch={{ area: id }}>{row.name}</NavLink> : row.name}
      </SkSimpleTableCell>
      {COLUMNS.map(c => (
        <SkSimpleTableCell key={c.key} className={styles.measure}>
          <span className={styles.bar} style={{ width: `${(row[c.key] / max(c.key)) * 100}%` }} aria-hidden="true" />
          <span className={styles.value}>{row[c.key]}</span>
        </SkSimpleTableCell>
      ))}
    </SkSimpleTableRow>
  )
}

export function MonolithTable({ rows }: { rows: MonolithRow[] }) {
  const [sort, setSort] = useState<Measure>('files')
  const mapped = rows.filter(r => r.areaId !== null).sort((a, b) => b[sort] - a[sort] || a.name.localeCompare(b.name))
  const max = (key: Measure) => Math.max(1, ...rows.map(r => r[key]))
  return (
    <SkSimpleTable size="small" className={styles.table} aria-label="skello-app by product area">
      <SkSimpleTableHead>
        <SkSimpleTableRow>
          <SkSimpleTableCell scope="col">Product area</SkSimpleTableCell>
          {COLUMNS.map(c => (
            <SkSimpleTableCell key={c.key} scope="col" aria-sort={sort === c.key ? 'descending' : 'none'}>
              <SkButton variant="text" size="small" onClick={() => setSort(c.key)}>{c.label}</SkButton>
            </SkSimpleTableCell>
          ))}
        </SkSimpleTableRow>
      </SkSimpleTableHead>
      <SkSimpleTableBody>
        {[...mapped, ...rows.filter(r => r.areaId === null)].map(row => <Row key={row.name} row={row} max={max} />)}
      </SkSimpleTableBody>
    </SkSimpleTable>
  )
}
