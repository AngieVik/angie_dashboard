import { Toaster as SonnerToaster } from 'sonner'
import styles from './sonner.module.css'

export function Toaster({ scale = 1 }: { scale?: number }) {
  const offset = { top: Math.ceil(36 * scale) + 8, right: 12, left: 12 }
  return <SonnerToaster position="top-right" theme="dark" duration={5000} visibleToasts={1} closeButton
    offset={offset} mobileOffset={offset} containerAriaLabel="Avisos"
    toastOptions={{ unstyled: true, classNames: {
      toast: styles.toast, title: styles.title, description: styles.description, content: styles.content, icon: styles.icon, error: styles.error, closeButton: styles.close,
    } }} />
}
