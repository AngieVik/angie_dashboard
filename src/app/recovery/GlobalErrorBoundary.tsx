import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '../../components/ui/button'
import { getDocumentStore } from '../../features/document/documentStore'
import { createBrowserFilePlatform } from '../../platform/files/fileAccess'
import { ErrorBoundary } from './ErrorBoundary'
import { createEmergencyCopy, listenForUnexpectedErrors } from './uiRecovery'
import styles from './recovery.module.css'

function RecoveryCopy() {
  const [message, setMessage] = useState<string | null>(null)
  const [manualCopy, setManualCopy] = useState<string | null>(null)
  function download() {
    let text: string | undefined
    try {
      const copy = createEmergencyCopy(getDocumentStore().getSnapshot().document)
      text = copy.text
      createBrowserFilePlatform().download(copy.text, copy.filename)
      setManualCopy(null)
      setMessage('Descarga iniciada. Conserva este JSON de recuperación.')
    } catch {
      setManualCopy(text ?? null)
      setMessage(text ? 'No se pudo iniciar la descarga. Copia el contenido en un archivo .json.' : 'No se pudo preparar la copia. Reintenta sin cerrar esta página.')
    }
  }
  return <>
    <Button onClick={download}>Descargar copia recuperable</Button>
    {message && <p role="status">{message}</p>}
    {manualCopy && <textarea className={styles.manualCopy} aria-label="JSON recuperable" readOnly value={manualCopy} onFocus={event => event.currentTarget.select()} />}
  </>
}

function GlobalFailure({ retry }: { retry: () => void }) {
  return <main className={styles.global}>
    <section className={styles.panel} role="alert" aria-label="Recuperación de Angie">
      <h1>No se pudo mostrar Angie</h1>
      <p>El documento disponible sigue en memoria. Descarga una copia antes de cerrar esta página.</p>
      <p>La copia no incluye archivos GPX externos, agenda ni temporizadores.</p>
      <div className={styles.actions}><RecoveryCopy /><Button onClick={retry}>Reintentar interfaz</Button></div>
    </section>
  </main>
}

function UnexpectedErrorNotice() {
  const [visible, setVisible] = useState(false)
  useEffect(() => listenForUnexpectedErrors(window, error => {
    console.error('Error no controlado al ejecutar una acción', error)
    setVisible(true)
  }), [])
  if (!visible) return null
  return <aside className={styles.notice} role="alert" aria-label="Error de acción">
    <p>No se pudo completar una acción. Revisa el resultado antes de reintentar.</p>
    <div className={styles.actions}><RecoveryCopy /><Button onClick={() => setVisible(false)}>Cerrar aviso</Button></div>
  </aside>
}

export function GlobalErrorBoundary({ children }: { children: ReactNode }) {
  return <>
    <UnexpectedErrorNotice />
    <ErrorBoundary scope="Angie" fallback={retry => <GlobalFailure retry={retry} />}>{children}</ErrorBoundary>
  </>
}
