import type { ProductArea } from '@dependency-explorer/data'
import { SkChip } from '@skelloapp/skello-ds-web'
import { areaPatch } from '../../hooks/useUrlState'
import { NavChip } from '../../shell/NavLink'

export function AreaChip({ area, primary, linked }: { area: ProductArea; primary?: boolean; linked?: boolean }) {
  const label = `${primary ? '★ ' : ''}${area.name}`
  const title = primary ? 'primary area' : undefined
  const sx = { color: area.color, borderColor: area.color }
  return linked
    ? <NavChip patch={areaPatch(area.id)} label={label} title={title} sx={sx} />
    : <SkChip size="small" variant="outlined" label={label} title={title} sx={sx} />
}
