import { CloseIcon, SkIconButton } from '@skelloapp/skello-ds-web'

export function CloseButton({ label = 'Close', className, onClick }: { label?: string; className?: string; onClick: () => void }) {
  return (
    <SkIconButton aria-label={label} size="small" className={className} onClick={onClick}>
      <CloseIcon />
    </SkIconButton>
  )
}
