import { expect, test } from '@playwright/test'
import { bringModuleToFront, createElement, loadDocument, noPageScroll, openModule, savedDocument } from './acceptance-helpers'
import { createEmptyDocument } from '../../src/domain/document/defaultDocument'

test('pizarra integrada: tacto de un dedo, prioridad de dos dedos y recuperación offline', async ({ page, context, isMobile }, info) => {
  test.skip(!isMobile, 'Solo emulación Android con tacto Chromium')
  await page.goto('/')
  await openModule(page, 'Pizarra'); await openModule(page, 'Elementos')
  await createElement(page, 'Tango táctil', true)
  await page.getByRole('button', { name: 'Cerrar Pizarra' }).click()
  await openModule(page, 'Pizarra')
  await bringModuleToFront(page, 'Pizarra')
  const session = await context.newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: { x: number; y: number; id: number }[]) => session.send('Input.dispatchTouchEvent', { type, touchPoints })
  const rect = (await page.locator('.board-pin-visual').boundingBox())!
  const finger = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, id: 1 }
  await touch('touchStart', [finger]); await page.waitForTimeout(280)
  await touch('touchMove', [{ ...finger, x: finger.x + 10, y: finger.y + 5 }]); await touch('touchEnd', [])
  await expect.poll(async () => (await savedDocument(page))?.elements[0]?.position?.x ?? 0).toBeGreaterThan(500)
  await page.getByRole('radio', { name: 'Lápiz', exact: true }).click()
  const board = (await page.getByTestId('board-surface').boundingBox())!
  const a = { x: board.x + board.width * .2, y: board.y + board.height * .2, id: 1 }
  const b = { x: board.x + board.width * .7, y: a.y, id: 2 }
  const before = (await savedDocument(page))!
  await touch('touchStart', [a]); await touch('touchMove', [{ ...a, x: a.x + 4 }])
  await touch('touchStart', [{ ...a, x: a.x + 4 }, b])
  await touch('touchMove', [{ ...a, x: a.x - 15 }, { ...b, x: b.x + 15 }]); await touch('touchEnd', [])
  const scale = Number(await page.getByTestId('board-surface').getAttribute('data-scale'))
  expect(scale).toBeGreaterThan(1)
  await expect(page.getByTestId('mobile-viewport')).toHaveAttribute('data-scale', '1')
  expect((await savedDocument(page))?.board).toEqual(before.board)
  expect((await savedDocument(page))?.elements).toEqual(before.elements)
  await page.getByRole('button', { name: 'Encajar' }).click()
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  await context.setOffline(true); await page.reload()
  await expect(page.locator('[data-module]')).toHaveCount(0)
  await openModule(page, 'Pizarra')
  await expect(page.getByRole('button', { name: 'Seleccionar Tango táctil' })).toHaveAttribute('aria-pressed', 'false')
  expect((await savedDocument(page))?.elements).toEqual(before.elements)
  await noPageScroll(page)
  await page.screenshot({ path: info.outputPath('mobile-board-offline.png') })
  await session.detach()
})

test('dos dedos sobre Información superpuesta navegan dashboard aunque haya pizarra detrás', async ({ page, context, isMobile }) => {
  test.skip(!isMobile, 'Solo emulación Android con tacto Chromium')
  await page.goto('/')
  const document = createEmptyDocument(), size = await page.getByTestId('mobile-viewport').evaluate(el => ({ width: el.clientWidth, height: el.clientHeight }))
  document.moduleLayouts = {
    board: { x: 0, y: 0, width: 410, height: 480, referenceSize: size },
    information: { x: 20, y: 120, width: 320, height: 240, referenceSize: size },
  }
  await loadDocument(page, document); await openModule(page, 'Pizarra'); await openModule(page, 'Información')
  const rect = (await page.locator('[data-module="information"] .module-content').boundingBox())!
  const session = await context.newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: { x: number; y: number; id: number }[]) => session.send('Input.dispatchTouchEvent', { type, touchPoints })
  const a = { x: rect.x + 70, y: rect.y + 60, id: 1 }, b = { x: rect.x + 170, y: a.y, id: 2 }
  const before = await savedDocument(page)
  await touch('touchStart', [a, b]); await touch('touchMove', [{ ...a, x: a.x - 10 }, { ...b, x: b.x + 10 }]); await touch('touchEnd', [])
  expect(Number(await page.getByTestId('mobile-viewport').getAttribute('data-scale'))).toBeGreaterThan(1)
  await expect(page.getByTestId('board-surface')).toHaveAttribute('data-scale', '1')
  expect(await savedDocument(page)).toEqual(before)
  await session.detach()
})

test('gesto cruzado cancela ambas cámaras y contenido hasta levantar todos; fuera navega solo dashboard', async ({ page, context, isMobile }) => {
  test.skip(!isMobile, 'Solo emulación Android con tacto Chromium')
  await page.goto('/'); await openModule(page, 'Pizarra')
  await page.getByRole('radio', { name: 'Lápiz', exact: true }).click()
  const surface = (await page.getByTestId('board-surface').boundingBox())!, header = (await page.locator('[data-module="board"] .module-header').boundingBox())!
  const session = await context.newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: { x: number; y: number; id: number }[]) => session.send('Input.dispatchTouchEvent', { type, touchPoints })
  const camera = () => page.locator('[data-testid="mobile-viewport"], [data-testid="board-surface"]').evaluateAll(elements => elements.map(el => [el.getAttribute('data-scale'), el.getAttribute('data-offset-x'), el.getAttribute('data-offset-y')]))
  const before = (await savedDocument(page))!, originalCameras = await camera()
  const a = { x: surface.x + 100, y: surface.y + 80, id: 1 }, b = { x: header.x + 240, y: header.y + header.height / 2, id: 2 }
  await touch('touchStart', [a]); await touch('touchMove', [{ ...a, x: a.x + 8 }])
  await touch('touchStart', [{ ...a, x: a.x + 8 }, b])
  await touch('touchMove', [{ ...a, x: a.x - 20 }, { ...b, x: b.x + 20 }])
  await touch('touchEnd', [a]); await touch('touchMove', [{ ...a, x: a.x + 40 }]); await touch('touchEnd', [])
  expect(await camera()).toEqual(originalCameras)
  expect(await savedDocument(page)).toEqual(before)
  const outsideA = { x: header.x + 140, y: b.y, id: 1 }, outsideB = { x: header.x + 240, y: b.y, id: 2 }
  await touch('touchStart', [outsideA, outsideB])
  await touch('touchMove', [{ ...outsideA, x: outsideA.x - 15 }, { ...outsideB, x: outsideB.x + 15 }]); await touch('touchEnd', [])
  expect(Number(await page.getByTestId('mobile-viewport').getAttribute('data-scale'))).toBeGreaterThan(1)
  await expect(page.getByTestId('board-surface')).toHaveAttribute('data-scale', '1')
  expect(await savedDocument(page)).toEqual(before)
  await session.detach()
})
