import styles from './OperationalStatusIcon.module.css'

export function OperationalStatusIcon({ icon, color }: { icon?: string; color?: string }) {
  const circle = color !== undefined || Boolean(icon && icon !== '💠')
  return <span
    className={`${styles.base} ${circle ? styles.circle : ''}`.trim()}
    data-icon={icon}
    aria-hidden="true"
    style={color !== undefined ? { backgroundColor: color } : undefined}
  >{icon === '💠' ? icon : null}</span>
}
