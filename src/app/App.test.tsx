import { readFileSync } from 'node:fs'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { getDocumentStore } from '../features/document/documentStore'

// jsdom does not resolve CSS custom properties. Check their actual definitions
// here and verify resolved fonts in the real browser smoke tests.
const styles = document.createElement('style')

beforeAll(() => {
  styles.textContent = readFileSync('src/styles/tokens.css', 'utf8') + readFileSync('src/styles/global.css', 'utf8')
  document.head.append(styles)
})
afterAll(() => styles.remove())

describe('base de Angie Dashboard', () => {
  async function open(name: string) {
    fireEvent.keyDown(screen.getByRole('button', { name: 'Ver' }), { key: 'Enter' })
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name }))
    await screen.findByRole('region', { name })
  }
  it('medir y rotar adapta la ventana sin reescribir su geometría ni updatedAt', async () => {
    let measure: (() => void) | undefined
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { measure = callback }
      observe() {}
      disconnect() {}
    })
    try {
      const store = getDocumentStore()
      await act(async () => { await store.newDocument(); store.mutateDocument(document => {
        document.moduleLayouts.information = { x: 640, y: 380, width: 320, height: 240, referenceSize: { width: 1600, height: 1000 } }
      }) })
      const before = structuredClone(store.getSnapshot().document)
      render(<App />)
      const workspace = screen.getByRole('main', { name: 'Espacio de trabajo' })
      const resize = (width: number, height: number) => act(() => {
        Object.defineProperties(workspace, { clientWidth: { value: width, configurable: true }, clientHeight: { value: height, configurable: true } })
        measure?.()
      })
      resize(1360, 800)
      await open('Información')
      const module = workspace.querySelector('[data-module="information"]')!
      expect(module).toHaveAttribute('data-x', '520')
      expect(module).toHaveAttribute('data-y', '280')
      expect(screen.getByLabelText('Zoom actual')).toHaveValue(100)
      resize(412, 871)
      expect(module).toHaveAttribute('data-x', '46')
      resize(1600, 1000)
      expect(module).toHaveAttribute('data-x', '640')
      expect(module).toHaveAttribute('data-y', '380')
      expect(store.getSnapshot().document).toEqual(before)
    } finally { vi.unstubAllGlobals() }
  })
  it('activar tres ventanas por puntero y foco conserva el orden relativo de las restantes', async () => {
    await act(async () => { await getDocumentStore().newDocument() })
    render(<App />)
    await open('Información'); await open('Elementos'); await open('Coordenadas')
    const module = (id: string) => document.querySelector<HTMLElement>(`[data-module="${id}"]`)!
    fireEvent.pointerDown(screen.getByRole('heading', { name: 'Información' }), { pointerId: 1 })
    expect([module('elements').style.zIndex, module('coordinates').style.zIndex, module('information').style.zIndex]).toEqual(['1', '2', '3'])
    fireEvent.focus(screen.getByRole('button', { name: 'Añadir' }))
    expect([module('coordinates').style.zIndex, module('information').style.zIndex, module('elements').style.zIndex]).toEqual(['1', '2', '3'])
    fireEvent.focus(screen.getByRole('button', { name: 'Cerrar Coordenadas' }))
    expect([module('information').style.zIndex, module('elements').style.zIndex, module('coordinates').style.zIndex]).toEqual(['1', '2', '3'])
  })
  it('integra Archivo y el título editable con el documento activo', async () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'Archivo' })).toBeInTheDocument()
    const title = screen.getByRole('textbox', { name: 'Título del documento' })
    fireEvent.change(title, { target: { value: 'Preparación norte' } })
    await waitFor(() => expect(title).toHaveValue('Preparación norte'))
  })
  it('muestra la cabecera con el nombre de la aplicación', () => {
    render(<App />)
    expect(screen.getByRole('banner')).toContainElement(
      screen.getByRole('heading', { name: 'Angie Dashboard', level: 1 }),
    )
  })

  it('comienza con el espacio de trabajo vacío y sin módulos', () => {
    render(<App />)
    expect(screen.getByRole('main', { name: 'Espacio de trabajo' }).querySelectorAll('[data-module]')).toHaveLength(0)
  })

  it('aplica Roboto Condensed a la interfaz y reserva monoespaciada para datos técnicos', () => {
    render(<App />)
    const rootStyle = getComputedStyle(document.documentElement)
    expect(rootStyle.getPropertyValue('--font-interface')).toContain('Roboto Condensed')
    expect(rootStyle.getPropertyValue('--font-technical')).toContain('monospace')
    expect(getComputedStyle(document.body).fontFamily).toContain('var(--font-interface)')
    const technicalSample = document.createElement('code')
    technicalSample.className = 'technical-data'
    technicalSample.textContent = '00:00:00'
    document.body.append(technicalSample)
    expect(getComputedStyle(technicalSample).fontFamily).toContain('var(--font-technical)')
    technicalSample.remove()
  })
})
