import { readFileSync } from 'node:fs'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { App } from './App'

// jsdom does not resolve CSS custom properties. Check their actual definitions
// here and verify resolved fonts in the real browser smoke tests.
const styles = document.createElement('style')

beforeAll(() => {
  styles.textContent = readFileSync('src/styles/tokens.css', 'utf8') + readFileSync('src/styles/global.css', 'utf8')
  document.head.append(styles)
})
afterAll(() => styles.remove())

describe('base de Angie Dashboard', () => {
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
