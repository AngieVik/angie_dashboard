import type { ComponentProps } from 'react'
import { RadioTower } from 'lucide-react'
import { Button } from '@/components/ui/button'
import controlStyles from '@/layout/controlButton.module.css'
import styles from './radarButton.module.css'

export interface RadarControl { active: boolean; onToggle: () => void }
export function RadarButton({ active, onToggle, activationColor = 'standard', appearance = 'integrated', className = '', ...props }: Omit<ComponentProps<typeof Button>, 'aria-pressed' | 'aria-label' | 'onClick'> & RadarControl & { activationColor?: 'standard' | 'yellow' }) {
  return <Button appearance={appearance} {...props} data-control="coordinate-radar" data-activation-color={activationColor}
    className={`${appearance === 'integrated' ? controlStyles.base : ''} ${styles.base} ${className}`.trim()} aria-label="Recepción automática de coordenadas" aria-pressed={active} onClick={onToggle}>
    <RadioTower aria-hidden="true" />
  </Button>
}
