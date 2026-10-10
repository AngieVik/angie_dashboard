import { readFileSync } from 'node:fs'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { createElement } from '../features/elements/elementCommands'
// jsdom has no canvas; Pizarra pixels are verified in E2E.
vi.mock('react-konva', () => ({ Stage: () => null, Layer: () => null, Rect: () => null, Image: () => null, Line: () => null, Circle: () => null, Group: () => null }))

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
      expect(module).toHaveAttribute('data-x', '320')
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
    fireEvent.focus(screen.getByRole('button', { name: 'Crear' }))
    expect([module('coordinates').style.zIndex, module('information').style.zIndex, module('elements').style.zIndex]).toEqual(['1', '2', '3'])
    fireEvent.focus(screen.getByRole('button', { name: 'Cerrar Coordenadas' }))
    expect([module('information').style.zIndex, module('elements').style.zIndex, module('coordinates').style.zIndex]).toEqual(['1', '2', '3'])
  })
  it('los iconos de abiertos activan y traen al frente sin modificar el documento', async () => {
    const store = getDocumentStore()
    await act(async () => { await store.newDocument() })
    render(<App />)
    await open('Información'); await open('Coordenadas')
    const before = structuredClone(store.getSnapshot().document)
    fireEvent.click(within(document.querySelector('.app-header') as HTMLElement).getByRole('button', { name: 'Seleccionar módulo Información' }))
    expect(screen.getByRole('region', { name: 'Información' })).toHaveAttribute('data-active', 'true')
    expect(document.querySelector('[data-module="information"]')).toHaveStyle({ zIndex: '2' })
    expect(store.getSnapshot().document).toEqual(before)
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar Información' }))
    expect(screen.queryByRole('button', { name: 'Seleccionar módulo Información' })).not.toBeInTheDocument()
  })
  it('una zona libre de cualquier módulo o del dashboard deselecciona sin afectar controles ni arrastres', async () => {
    const store = getDocumentStore()
    await act(async () => {
      await store.newDocument()
      store.mutateDocument(doc => createElement(doc, { name: 'Referencia', isUnit: false, information: '', visual: { type: 'emoji', value: '📍', scale: 1 }, position: { x: 100, y: 100 } }))
    })
    render(<App />)
    await open('Elementos'); await open('Información')
    const choose = () => fireEvent.click(screen.getByRole('button', { name: 'Seleccionar Referencia' }))
    const row = document.querySelector('.element-row')!
    choose()
    fireEvent.click(screen.getByRole('spinbutton', { name: 'Zoom de Información' }))
    expect(row).toHaveAttribute('data-selected', 'true')
    fireEvent.click(screen.getByRole('region', { name: 'Información' }).querySelector('.module-content')!)
    expect(row).toHaveAttribute('data-selected', 'false')
    choose()
    const workspace = screen.getByRole('main')
    fireEvent.pointerDown(workspace, { pointerId: 1, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(workspace, { pointerId: 1, clientX: 30, clientY: 10 })
    fireEvent.click(workspace)
    expect(row).toHaveAttribute('data-selected', 'true')
    fireEvent.pointerDown(workspace, { pointerId: 2, clientX: 10, clientY: 10 })
    fireEvent.click(workspace)
    expect(row).toHaveAttribute('data-selected', 'false')
  })
  it('volver al origen conserva zoom, geometría y documento y precede a los iconos de módulos', async () => {
    const store = getDocumentStore()
    await act(async () => { await store.newDocument() })
    render(<App />)
    await open('Información')
    const zoom = screen.getByLabelText('Zoom actual')
    fireEvent.change(zoom, { target: { value: '200' } }); fireEvent.keyDown(zoom, { key: 'Enter' })
    const viewport = screen.getByTestId('mobile-viewport')
    fireEvent.pointerDown(viewport, { pointerId: 1, button: 0, clientX: 700, clientY: 600 })
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 600, clientY: 500 })
    fireEvent.pointerUp(viewport, { pointerId: 1 })
    expect(viewport).toHaveAttribute('data-offset-x', '-100')
    const before = structuredClone(store.getSnapshot().document)
    const origin = screen.getByRole('button', { name: 'Volver al origen' })
    fireEvent.click(origin)
    expect(viewport).toHaveAttribute('data-offset-x', '0')
    expect(viewport).toHaveAttribute('data-offset-y', '0')
    expect(zoom).toHaveValue(200)
    expect(store.getSnapshot().document).toEqual(before)
    expect(origin.compareDocumentPosition(screen.getByRole('button', { name: 'Seleccionar módulo Información' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
  it('el imán se activa sin cambiar el documento y está a la izquierda de Puzzle', async () => {
    const store = getDocumentStore()
    await act(async () => { await store.newDocument() })
    render(<App />)
    const before = structuredClone(store.getSnapshot().document)
    const magnet = screen.getByRole('button', { name: 'Imán de módulos' })
    expect(magnet).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(magnet)
    expect(magnet).toHaveAttribute('aria-pressed', 'true')
    expect(magnet.compareDocumentPosition(screen.getByRole('button', { name: 'Encajar' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(store.getSnapshot().document).toEqual(before)
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

describe('Puzzle compacto', () => {
  it('conserva zoom y documento cuando no hay abiertos', async () => {
    const store = getDocumentStore()
    await act(async () => { await store.newDocument(); store.mutateDocument(doc => { doc.moduleLayouts.clock = { x: 800, y: 500, width: 440, height: 260, referenceSize: { width: 1600, height: 1000 } } }) })
    render(<App />)
    const zoom = screen.getByLabelText('Zoom actual')
    fireEvent.change(zoom, { target: { value: '200' } }); fireEvent.keyDown(zoom, { key: 'Enter' })
    const before = structuredClone(store.getSnapshot().document)
    fireEvent.click(screen.getByRole('button', { name: 'Encajar' }))
    expect(zoom).toHaveValue(200)
    expect(store.getSnapshot().document).toEqual(before)
  })
  it('compacta abiertos sin cambiar módulos cerrados ni contenido', async () => {
    const store = getDocumentStore()
    await act(async () => { await store.newDocument(); store.mutateDocument(doc => {
      doc.moduleLayouts.elements = { x: 30, y: 40, width: 300, height: 420, referenceSize: { width: 1600, height: 1000 } }
      doc.moduleLayouts.information = { x: 50, y: 50, width: 320, height: 240, referenceSize: { width: 1600, height: 1000 } }
      doc.moduleLayouts.clock = { x: 800, y: 500, width: 440, height: 260, referenceSize: { width: 1600, height: 1000 } }
    }) })
    render(<App />)
    for (const name of ['Información', 'Elementos']) {
      fireEvent.keyDown(screen.getByRole('button', { name: 'Ver' }), { key: 'Enter' })
      fireEvent.click(await screen.findByRole('menuitemcheckbox', { name }))
    }
    const before = structuredClone(store.getSnapshot().document)
    fireEvent.click(screen.getByRole('button', { name: 'Encajar' }))
    const after = store.getSnapshot().document
    expect(after.moduleLayouts.elements).toMatchObject({ x: 0, y: 0, width: 320, height: 420 })
    expect(after.moduleLayouts.information!.width).toBeGreaterThanOrEqual(256)
    expect(after.moduleLayouts.information!.height).toBeLessThanOrEqual(288)
    expect(after.moduleLayouts.clock).toEqual(before.moduleLayouts.clock)
    expect(after.elements).toEqual(before.elements)
  })
})

it('Puzzle conserva documento, presentación y cámara si falla la aplicación validada', async () => {
  const store = getDocumentStore()
  await act(async () => { await store.newDocument(); store.mutateDocument(doc => {
    doc.moduleLayouts.information = { x: 90, y: 100, width: 100, height: 100, referenceSize: { width: 1600, height: 1000 } }
  }) })
  render(<App />)
  fireEvent.keyDown(screen.getByRole('button', { name: 'Ver' }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Información' }))
  const module = document.querySelector('[data-module="information"]')!
  const before = structuredClone(store.getSnapshot().document), html = module.outerHTML
  const fail = vi.spyOn(store, 'mutateDocument').mockImplementationOnce(() => { throw new Error('Validación rechazada') })
  fireEvent.click(screen.getByRole('button', { name: 'Encajar' }))
  expect(store.getSnapshot().document).toEqual(before)
  expect(module.outerHTML).toBe(html)
  fail.mockRestore()
  fireEvent.click(screen.getByRole('button', { name: 'Encajar' }))
  expect(store.getSnapshot().document.moduleLayouts.information).toMatchObject({ width: 100, height: 100, x: 0, y: 0 })
  expect(module).toHaveAttribute('data-width', '100')
})

it('Nuevo reconstruye desde el documento nuevo con una ventana lejana todavía abierta', async () => {
  const store = getDocumentStore()
  await act(async () => { await store.newDocument(); store.mutateDocument(doc => {
    doc.moduleLayouts.information = { x: 5000, y: 4000, width: 320, height: 240, referenceSize: { width: 6000, height: 5000 } }
  }) })
  render(<App />)
  fireEvent.keyDown(screen.getByRole('button', { name: 'Ver' }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Información' }))
  expect(document.querySelector('.logical-workspace')).toHaveStyle({ width: '6000px' })
  act(() => store.newDocument())
  expect(document.querySelector('[data-module="information"]')).toHaveAttribute('data-x', '0')
  expect(document.querySelector('.logical-workspace')).not.toHaveStyle({ width: '6000px' })
})


it('Pizarra abre y activa listas sin cerrarlas al repetir ni crear objetos', async () => {
  const store = getDocumentStore()
  await act(async () => { await store.newDocument(); store.mutateDocument(doc => createElement(doc, { name: 'Referencia', isUnit: false, information: '', visual: { type: 'emoji', value: '📍', scale: 1 }, position: { x: 100, y: 100 } })) })
  render(<App />)
  fireEvent.keyDown(screen.getByRole('button', { name: 'Ver' }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Pizarra' }))
  fireEvent.click(screen.getByRole('button', { name: 'Seleccionar Referencia' }))
  const before = structuredClone(store.getSnapshot().document)
  for (const name of ['Dotaciones', 'Elementos', 'Dotaciones']) {
    fireEvent.click(screen.getByRole('button', { name: 'Abrir ' + name }))
    const id = name === 'Dotaciones' ? 'dotations' : 'elements'
    expect(document.querySelector('[data-module="' + id + '"] .module-frame')).toHaveAttribute('data-active', 'true')
    expect(document.querySelector('.board-pin')).toHaveAttribute('data-selected', 'true')
    expect(store.getSnapshot().document).toEqual(before)
  }
})
