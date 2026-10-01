import type { ProductArea } from '@dependency-explorer/data'

export function AreaChip({ area, primary, onClick }: { area: ProductArea; primary?: boolean; onClick?: () => void }) {
  const style = {
    fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 4,
    border: `1px solid ${area.color}${primary ? 'aa' : '44'}`,
    background: `${area.color}${primary ? '33' : '18'}`, color: area.color,
  }
  const label = `${primary ? '★ ' : ''}${area.name}`
  if (!onClick) {
    return <span title={primary ? 'primary area' : undefined} style={style}>{label}</span>
  }
  return (
    <button type="button" onClick={onClick} title={primary ? 'primary area' : undefined} style={{ ...style, cursor: 'pointer' }}>
      {label}
    </button>
  )
}
