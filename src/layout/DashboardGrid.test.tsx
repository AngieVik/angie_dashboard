import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { DashboardGrid } from './DashboardGrid'
import { TooltipProvider } from '../components/ui/tooltip'
import { MobileViewport } from './MobileViewport'

function Content() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(value => value + 1)}>Contenido {count}</button>
}
it('dos dedos cancelan la manipulación sin desmontar ni perder el estado temporal del contenido', () => {
  render(<TooltipProvider><MobileViewport state={{ scale: 1, offsetX: 0, offsetY: 0 }} size={{ width: 1600, height: 1000 }} onChange={vi.fn()}>
    <DashboardGrid bounds={{ width: 1600, height: 1000 }} layers={['board']} modules={[{ id: 'board', layout: { x: 0, y: 0, width: 720, height: 480, referenceSize: { width: 1600, height: 1000 } } }]}
      active="board" scale={1} onActive={vi.fn()} onClose={vi.fn()} onLayout={vi.fn()} renderModule={() => <Content />} />
  </MobileViewport></TooltipProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Contenido 0' }))
  const header = screen.getByRole('heading', { name: 'Pizarra' })
  fireEvent.pointerDown(header, { pointerId: 1, clientX: 20, clientY: 20 })
  fireEvent.pointerDown(header, { pointerId: 2, clientX: 50, clientY: 20 })
  expect(screen.getByRole('button', { name: 'Contenido 1' })).toBeInTheDocument()
  fireEvent.pointerUp(header, { pointerId: 1 }); fireEvent.pointerUp(header, { pointerId: 2 })
  expect(screen.getByRole('button', { name: 'Contenido 1' })).toBeInTheDocument()
})
