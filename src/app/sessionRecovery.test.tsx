import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { createDocumentStore } from '../features/document/documentStore'
import { createEmptyDocument } from '../domain/document/defaultDocument'
import { App } from './App'
let testStore: ReturnType<typeof createDocumentStore>
vi.mock('../features/document/documentStore', async importOriginal => ({ ...await importOriginal<typeof import('../features/document/documentStore')>(), getDocumentStore: () => testStore }))
vi.mock('react-konva', () => ({ Stage: () => null, Layer: () => null, Rect: () => null, Image: () => null, Line: () => null, Circle: () => null, Group: () => null }))
it.each(['Colapsados en filas', 'Colapsados en columnas'])('Vista %s colapsa a 200x27 y conserva el tamaño de restauración', async command => {
  const recovered = createEmptyDocument()
  const referenceSize = { width: 1600, height: 1000 }
  recovered.moduleLayouts.board = { x: 50, y: 50, width: 400, height: 300, referenceSize }
  recovered.moduleLayouts.notebook = { x: 500, y: 50, width: 360, height: 420, referenceSize }
  testStore = createDocumentStore({ loadActive: async () => recovered, loadActiveSession: async () => ({ openModules: ['board', 'notebook'] }), saveActive: async () => {}, clearActive: async () => {} }, { platform: { download: () => {} } })
  await act(async () => { await testStore.initialize() })
  render(<App />)
  const ids = ['board', 'notebook'] as const
  const sizes = ids.map(id => {
    const module = document.querySelector<HTMLElement>(`[data-module="${id}"]`)!
    return { width: Number(module.dataset.width), height: Number(module.dataset.height) }
  })
  fireEvent.keyDown(screen.getByRole('button', { name: 'Vista' }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: command }))
  for (const id of ids) {
    const module = document.querySelector(`[data-module="${id}"]`)!
    expect(module).toHaveAttribute('data-width', '200')
    expect(module).toHaveAttribute('data-height', '27')
    expect(testStore.getSnapshot().document.moduleLayouts[id]).toMatchObject({ width: 200, height: 27 })
  }
  fireEvent.keyDown(screen.getByRole('button', { name: 'Vista' }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Columnas' }))
  ids.forEach((id, index) => expect(testStore.getSnapshot().document.moduleLayouts[id]).toMatchObject(sizes[index]!))
})
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
