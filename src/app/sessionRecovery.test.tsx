import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { createDocumentStore } from '../features/document/documentStore'
import { createEmptyDocument } from '../domain/document/defaultDocument'
import { App } from './App'
let testStore: ReturnType<typeof createDocumentStore>
vi.mock('../features/document/documentStore', async importOriginal => ({ ...await importOriginal<typeof import('../features/document/documentStore')>(), getDocumentStore: () => testStore }))
vi.mock('react-konva', () => ({ Stage: () => null, Layer: () => null, Rect: () => null, Image: () => null, Line: () => null, Circle: () => null, Group: () => null }))
it('restaura los módulos solo después de recuperar y autoguarda sus cierres', async () => {
  let finish!: (document: ReturnType<typeof createEmptyDocument>) => void
  testStore = createDocumentStore({ loadActive: () => new Promise(resolve => { finish = resolve }), loadActiveSession: async () => ({ openModules: ['board', 'notebook'] }), saveActive: async () => {}, clearActive: async () => {} }, { platform: { download: () => {} } })
  render(<App />)
  expect(screen.queryByRole('region', { name: 'Pizarra' })).not.toBeInTheDocument()
  await act(async () => finish(createEmptyDocument('Recuperado')))
  await waitFor(() => expect(screen.getByRole('region', { name: 'Pizarra' })).toBeInTheDocument())
  expect(screen.getByRole('region', { name: 'Cuaderno' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Información' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar Cuaderno' }))
  await waitFor(() => expect(testStore.getSnapshot().openModules).toEqual(['board']))
})
