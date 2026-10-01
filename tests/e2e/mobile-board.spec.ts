import { expect, test } from '@playwright/test'
import { createElement, noPageScroll, openModule, savedDocument } from './acceptance-helpers'

test('pizarra integrada: tacto de un dedo, prioridad de dos dedos y recuperación offline', async ({ page, context, isMobile }, info) => {
  test.skip(!isMobile, 'Solo emulación Android con tacto Chromium')
  await page.goto('/')
  await openModule(page, 'Pizarra'); await openModule(page, 'Elementos')
  await createElement(page, 'Tango táctil', true)
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
  const scale = Number(await page.getByTestId('mobile-viewport').getAttribute('data-scale'))
  expect(scale).toBeGreaterThan(.3)
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
