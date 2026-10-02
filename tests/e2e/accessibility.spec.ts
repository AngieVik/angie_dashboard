import { expect, test } from '@playwright/test'
import { createEmptyDocument } from '../../src/domain/document/defaultDocument'
import { createElement as addElement } from '../../src/features/elements/elementCommands'
import { createElement, loadDocument, noPageScroll, openModule } from './acceptance-helpers'

const modules = ['Pizarra', 'Elementos', 'Información', 'Operativo', 'Coordenadas', 'Reloj', 'Calculadora', 'Cuaderno', 'Registro cronológico']
function fixture() {
  const document = createEmptyDocument('Accesibilidad V1')
  addElement(document, { name: 'Tango teclado', isUnit: true, visual: { type: 'emoji', value: '🚑', scale: 1 }, information: 'Radio · Canal 4', position: { x: 500, y: 500 } })
  document.notebook = [
    { id: crypto.randomUUID(), type: 'note', title: 'Nota', text: 'Preparación\n📻' },
    { id: crypto.randomUUID(), type: 'checklist', title: 'Checklist', items: [{ id: crypto.randomUUID(), text: 'Revisar radio', checked: false }] },
  ]
  document.board.quickNotes = [{ id: crypto.randomUUID(), text: 'Acceso norte', position: { x: 250, y: 250 }, width: 220, height: 96 }]
  document.timeline = [{ id: crypto.randomUUID(), type: 'manual', text: 'Preparación', occurredAt: '2026-01-01T12:00:00Z' }]
  return document
}

test('orden de Tab de cabecera, menús por teclado y foco recuperado al cerrar el módulo', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Archivo', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: 'Nuevo' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: 'Cargar' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: 'Guardar' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Archivo', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  const view = page.getByRole('button', { name: 'Ver', exact: true })
  await expect(view).toBeFocused()
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Home')
  await expect(page.getByRole('menuitemcheckbox', { name: 'Pizarra', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'Pizarra', exact: true })).toBeVisible()
  await expect(view).toBeFocused()
  await page.keyboard.press('Tab')
  const title = page.getByLabel('Título del documento')
  await expect(title).toBeFocused(); await expect(title).toHaveCSS('outline-style', 'solid')
  await page.keyboard.type('Título desde teclado')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Encajar' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Cerrar Pizarra' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-module]')).toHaveCount(0)
  await expect(view).toBeFocused()
  await page.keyboard.press('Tab'); await expect(title).toBeFocused()
})

test('todos los módulos: nombres accesibles y Tab con foco visible sin controles cerrados ni decoración', async ({ page }) => {
  await page.goto('/'); await loadDocument(page, fixture())
  for (const name of modules) {
    await openModule(page, name)
    const module = page.getByRole('region', { name, exact: true })
    if (name === 'Operativo') {
      await module.getByRole('button', { name: '🟢 1 Disponible' }).press('Enter')
      await module.getByRole('button', { name: 'Seleccionar Tango teclado' }).press('Enter')
    }
    if (name === 'Reloj') {
      for (const label of ['T-Zero', 'T-Minus', 'Advisories']) await module.getByRole('button', { name: label, exact: true }).press('Enter')
    }
    for (const control of await module.locator('button,input:not([hidden]),select,textarea').all()) {
      if (!await control.isVisible()) continue
      await expect(control).toHaveAccessibleName(/\S/)
    }
    await page.getByRole('button', { name: 'Archivo', exact: true }).focus()
    const visited: string[] = []
    // Tab must reach every enabled, visible control in this module. The browser
    // may also make internally scrolling containers focusable: audit those too.
    const controls = await module.locator('button,input,select,textarea').evaluateAll(nodes => nodes.filter(node => {
      const element = node as HTMLInputElement
      return !element.disabled && element.tabIndex >= 0 && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden'
    }).length)
    let interactive = 0
    for (let index = 0; index < controls + 12; index++) {
      await page.keyboard.press('Tab')
      const state = await page.evaluate(() => {
        const node = document.activeElement as HTMLElement
        const style = getComputedStyle(node)
        return { tag: node.tagName, name: node.getAttribute('aria-label') ?? node.textContent?.trim(), header: Boolean(node.closest('.app-header')),
          module: node.closest('[role="region"]')?.getAttribute('aria-label'), outline: style.outlineStyle, width: style.outlineWidth,
          visible: node.getClientRects().length > 0 && style.visibility !== 'hidden', inModule: Boolean(node.closest('[data-module]')),
          interactive: node.matches('button,input,select,textarea'), menuTrigger: node.textContent === 'Archivo' }
      })
      if (state.menuTrigger || state.tag === 'BODY') break
      expect(state.visible, `${name}: ${state.name}`).toBe(true)
      expect(state.outline, `${name}: ${state.name}`).not.toBe('none')
      expect(parseFloat(state.width), `${name}: ${state.name}`).toBeGreaterThan(0)
      expect(state.header || state.inModule, `${name}: ${state.tag}`).toBe(true)
      if (state.inModule) { visited.push(state.module ?? ''); if (state.interactive) interactive++ }
    }
    expect(visited).toContain(name)
    expect(visited.every(label => label === name)).toBe(true)
    expect(interactive, name).toBe(controls)
    await page.getByRole('button', { name: `Cerrar ${name}`, exact: true }).click()
    await noPageScroll(page)
  }
})

test('teclado: selección, estados con texto, etiquetas, calculadora y checklist', async ({ page }) => {
  await page.goto('/'); await loadDocument(page, fixture())
  await openModule(page, 'Elementos'); await openModule(page, 'Operativo')
  const elements = page.getByRole('region', { name: 'Elementos', exact: true })
  const selected = elements.getByRole('button', { name: 'Seleccionar Tango teclado' })
  await selected.press('Enter'); await expect(selected).toHaveAttribute('aria-pressed', 'true')
  await expect(elements.getByRole('group', { name: 'Filtrar por estado' })).toHaveCount(0)
  await expect(selected).toBeVisible()
  const ops = page.getByRole('region', { name: 'Operativo', exact: true })
  for (const name of ['Disponible', 'Asignada', 'En camino', 'En el lugar', 'En traslado', 'En destino', 'Operativa', 'Inoperativa']) {
    const button = ops.getByRole('button', { name, exact: true })
    await expect(button).toContainText(name)
    await button.press('Enter'); await expect(button).toHaveAttribute('aria-pressed', 'true')
  }
  await ops.getByRole('textbox', { name: 'Nueva etiqueta' }).fill('Radio')
  await ops.getByRole('textbox', { name: 'Nueva etiqueta' }).press('Enter')
  await ops.getByRole('button', { name: 'Editar etiqueta Radio' }).press('Enter')
  await ops.getByRole('textbox', { name: 'Editar etiqueta', exact: true }).fill('Canal 4')
  await ops.getByRole('textbox', { name: 'Editar etiqueta', exact: true }).press('Enter')
  await ops.getByRole('button', { name: 'Eliminar etiqueta Canal 4' }).press('Enter')
  await expect(ops.getByRole('button', { name: 'Editar etiqueta Canal 4' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Cerrar Elementos' }).click(); await page.getByRole('button', { name: 'Cerrar Operativo' }).click()
  await openModule(page, 'Calculadora')
  const calculator = page.getByRole('region', { name: 'Calculadora', exact: true })
  await calculator.getByLabel('Operación').fill('(200 + 10 %) / 2'); await calculator.getByLabel('Operación').press('Enter')
  await expect(calculator.getByLabel('Resultado', { exact: true })).toHaveText('110')
  await calculator.getByRole('button', { name: 'Limpiar' }).press('Enter')
  await expect(calculator.getByLabel('Operación')).toHaveValue('')
  await page.getByRole('button', { name: 'Cerrar Calculadora' }).click()
  await openModule(page, 'Cuaderno')
  const notebook = page.getByRole('region', { name: 'Cuaderno', exact: true })
  const checkbox = notebook.getByRole('checkbox', { name: 'Marcar elemento 1' })
  await checkbox.press('Space'); await expect(checkbox).toBeChecked()
  await notebook.getByRole('button', { name: 'Reordenar bloque 2' }).press('ArrowUp')
  await expect(notebook.locator('[data-block-type]').first()).toHaveAttribute('data-block-type', 'checklist')
})

test('editores de elementos: acciones directas recuperan foco tras guardar, cancelar, duplicar y quitar', async ({ page }) => {
  await page.goto('/'); await openModule(page, 'Elementos')
  await createElement(page, 'Tango foco', true)
  const module = page.getByRole('region', { name: 'Elementos', exact: true })
  const add = module.getByRole('button', { name: 'Añadir', exact: true })
  await expect(add).toBeFocused()
  for (const action of ['Modificar', 'Añadir']) {
    await module.getByRole('button', { name: action, exact: true }).press('Enter')
    await module.getByRole('button', { name: action === 'Modificar' ? 'Guardar elemento' : 'Cancelar', exact: true }).press('Enter')
    await expect(module.getByRole('button', { name: action, exact: true })).toBeFocused()
  }
  for (const action of ['Duplicar', 'Quitar']) {
    await module.getByRole('button', { name: action, exact: true }).press('Enter')
    await expect(add).toBeFocused()
  }
})

test('etiquetas: guardar, Escape, cancelar y eliminar conservan foco en Nueva etiqueta', async ({ page }) => {
  await page.goto('/'); await loadDocument(page, fixture())
  await openModule(page, 'Elementos'); await openModule(page, 'Operativo')
  await page.getByRole('region', { name: 'Elementos', exact: true }).getByRole('button', { name: 'Seleccionar Tango teclado' }).press('Enter')
  const module = page.getByRole('region', { name: 'Operativo', exact: true })
  const add = module.getByRole('textbox', { name: 'Nueva etiqueta' })
  await add.fill('Radio'); await add.press('Enter')
  await module.getByRole('button', { name: 'Editar etiqueta Radio' }).press('Enter')
  await module.getByRole('textbox', { name: 'Editar etiqueta', exact: true }).fill('Canal')
  await module.getByRole('textbox', { name: 'Editar etiqueta', exact: true }).press('Enter')
  await expect(add).toBeFocused()
  await module.getByRole('button', { name: 'Editar etiqueta Canal' }).press('Enter')
  await module.getByRole('textbox', { name: 'Editar etiqueta', exact: true }).press('Escape')
  await expect(add).toBeFocused()
  await module.getByRole('button', { name: 'Editar etiqueta Canal' }).press('Enter')
  await module.getByRole('button', { name: 'Cancelar edición de etiqueta' }).press('Enter')
  await expect(add).toBeFocused()
  await module.getByRole('button', { name: 'Eliminar etiqueta Canal' }).press('Enter')
  await expect(add).toBeFocused()
})

test('Cuaderno: eliminar bloque e ítem conserva foco en Añadir', async ({ page }) => {
  await page.goto('/'); await loadDocument(page, fixture()); await openModule(page, 'Cuaderno')
  const module = page.getByRole('region', { name: 'Cuaderno', exact: true })
  const checklist = module.locator('[data-block-type="checklist"]')
  await checklist.getByRole('button', { name: 'Eliminar elemento 1' }).press('Enter')
  await expect(checklist.getByRole('button', { name: 'Añadir elemento' })).toBeFocused()
  await checklist.getByRole('button', { name: 'Eliminar bloque' }).press('Enter')
  await expect(module.getByRole('button', { name: 'Checklist', exact: true })).toBeFocused()
})

test('Registro: guardar, cancelar, eliminar y Deshacer conservan foco en Acontecimiento', async ({ page }) => {
  await page.goto('/'); await loadDocument(page, fixture()); await openModule(page, 'Registro cronológico')
  const module = page.getByRole('region', { name: 'Registro cronológico', exact: true })
  const add = module.getByRole('textbox', { name: 'Acontecimiento' })
  for (const action of ['Guardar entrada', 'Cancelar']) {
    await module.getByRole('button', { name: 'Editar entrada' }).press('Enter')
    await module.getByRole('button', { name: action, exact: true }).press('Enter')
    await expect(add).toBeFocused()
  }
  await module.getByRole('button', { name: 'Eliminar entrada' }).press('Enter')
  await expect(add).toBeFocused()
  await openModule(page, 'Elementos'); await openModule(page, 'Operativo')
  await page.getByRole('region', { name: 'Elementos', exact: true }).getByRole('button', { name: 'Seleccionar Tango teclado' }).press('Enter')
  await page.getByRole('region', { name: 'Operativo', exact: true }).getByRole('button', { name: 'Asignada', exact: true }).press('Enter')
  await module.getByRole('button', { name: 'Deshacer' }).press('Enter')
  await expect(add).toBeFocused()
})

test('notas rápidas: edición, cancelación y borrado conservan foco en herramienta activa', async ({ page }) => {
  await page.goto('/'); await loadDocument(page, fixture()); await openModule(page, 'Pizarra')
  const module = page.getByRole('region', { name: 'Pizarra', exact: true })
  const select = module.getByRole('radio', { name: 'Seleccionar/mover' })
  await module.getByRole('button', { name: 'Acceso norte', exact: true }).press('Enter')
  for (const action of ['Guardar nota', 'Cancelar']) {
    await module.getByRole('button', { name: 'Editar nota', exact: true }).press('Enter')
    await module.getByRole('button', { name: action, exact: true }).press('Enter')
    await expect(select).toBeFocused()
  }
  await module.getByRole('button', { name: 'Eliminar nota', exact: true }).press('Enter')
  await expect(select).toBeFocused()
  await module.getByRole('radio', { name: 'Nota rápida', exact: true }).press('Enter')
  const square = (await page.getByTestId('board-surface').boundingBox())!
  await page.mouse.click(square.x + square.width / 2, square.y + square.height / 2)
  await module.getByLabel('Texto de nota rápida').fill('Radio')
  await module.getByRole('button', { name: 'Crear nota', exact: true }).press('Enter')
  await expect(select).toBeFocused()
})

test('seleccionar desde Información o contadores Operativo transfiere foco al contenido vigente', async ({ page }) => {
  await page.goto('/'); await loadDocument(page, fixture()); await openModule(page, 'Información')
  const information = page.getByRole('region', { name: 'Información', exact: true })
  await information.getByRole('button', { name: 'Seleccionar Tango teclado' }).press('Enter')
  await expect(information.getByRole('button', { name: 'Cerrar Información' })).toBeFocused()
  await page.reload(); await openModule(page, 'Operativo')
  const operations = page.getByRole('region', { name: 'Operativo', exact: true })
  await operations.getByRole('button', { name: '🟢 1 Disponible' }).press('Enter')
  await operations.getByRole('button', { name: 'Seleccionar Tango teclado' }).press('Enter')
  await expect(operations.getByRole('button', { name: 'Disponible', exact: true })).toBeFocused()
})
