import { Toaster as SonnerToaster } from 'sonner'
import styles from './sonner.module.css'
import { NOTICE_DURATION_DEFAULT } from '@/features/notices/noticePreferences'

export function Toaster({ scale = 1 }: { scale?: number }) {
  const offset = { top: `calc(var(--app-header-height) * ${scale} + 8px)`, right: 12, left: 12 }
  return <SonnerToaster position="top-right" theme="dark" duration={NOTICE_DURATION_DEFAULT * 1000} visibleToasts={1} closeButton
    offset={offset} mobileOffset={offset} containerAriaLabel="Avisos"
    toastOptions={{ unstyled: true, classNames: {
      toast: styles.toast, title: styles.title, description: styles.description, content: styles.content, icon: styles.icon, error: styles.error, closeButton: styles.close,
    } }} />
}
