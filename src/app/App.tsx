import { useEffect } from 'react'
import { Input } from '../components/ui/input'
import { FileMenu, DocumentNotices } from '../features/document/FileMenu'
import { getDocumentStore, useDocumentStore } from '../features/document/documentStore'

export function App() {
  const store = getDocumentStore()
  const { document } = useDocumentStore(store)
  useEffect(() => { void store.initialize() }, [store])
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Angie Dashboard</h1>
        <FileMenu store={store} />
        <Input aria-label="Título del documento" placeholder="Título del documento"
          value={document.document.title} onChange={event => store.setTitle(event.target.value)} />
      </header>
      <DocumentNotices store={store} />
      <main className="dashboard-workspace" aria-label="Espacio de trabajo" />
    </div>
  )
}
