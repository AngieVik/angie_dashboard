import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NoteBlock } from './NoteBlock'

let scrollHeight = 24
let onResize: ResizeObserverCallback
const note = { id: 'note', type: 'note' as const, title: 'Nota', text: '' }
function view(text: string) { return <NoteBlock block={{ ...note, text }} disabled={false} onEdit={() => {}} /> }

beforeEach(() => {
  scrollHeight = 24
  // JSDOM has no layout engine: supply only the browser measurement boundary.
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(() => scrollHeight)
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) { onResize = callback }
    observe() {}
    disconnect() {}
  })
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('altura automática del texto del Cuaderno', () => {
  it('parte de una fila, crece con el contenido y vuelve a reducirse al borrar', () => {
    const rendered = render(view(''))
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('rows', '1')
    expect(textarea.style.height).toBe('24px')
    scrollHeight = 76
    rendered.rerender(view('Uno\nDos\nTres 📻'))
    expect(textarea.style.height).toBe('76px')
    scrollHeight = 24
    rendered.rerender(view(''))
    expect(textarea.style.height).toBe('24px')
  })

  it('mide el texto cargado y reajusta su altura cuando cambia la anchura disponible', () => {
    scrollHeight = 76
    render(view('Texto cargado que se ajusta al ancho'))
    const textarea = screen.getByRole('textbox')
    expect(textarea.style.height).toBe('76px')
    scrollHeight = 128
    act(() => onResize([{ target: textarea, contentRect: { width: 150 } } as unknown as ResizeObserverEntry], {} as ResizeObserver))
    expect(textarea.style.height).toBe('128px')
    scrollHeight = 24
    act(() => onResize([{ target: textarea, contentRect: { width: 400 } } as unknown as ResizeObserverEntry], {} as ResizeObserver))
    expect(textarea.style.height).toBe('24px')
  })
})
