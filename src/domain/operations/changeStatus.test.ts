import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../document/defaultDocument'
import { DOCUMENT_STATUSES } from '../document/types'
import { validateDocument } from '../document/validateDocument'
import { createElement } from '../../features/elements/elementCommands'
import { OPERATIONAL_STATUSES } from './statuses'
import { changeElementStatus } from './changeStatus'
import { addUnitTag, editUnitTag, removeUnitTag, setUnitNotes } from './unitAnnotations'

function setup() {
  const document = createEmptyDocument()
  const unit = createElement(document, { name: 'Tango 1', visual: { type: 'emoji', value: '🚑', scale: 1 }, isUnit: true, information: 'Canal 4' })
  const general = createElement(document, { name: 'Acceso', visual: { type: 'emoji', value: '📍', scale: 1 }, isUnit: false, information: '' })
  return { document, unit, general }
}
describe('Estados y anotaciones operativas', () => {
  it('conserva los ocho estados, fases e iconos exactos en su orden', () => {
    expect(OPERATIONAL_STATUSES.map(item => [item.status, item.phase, item.icon])).toEqual([
      ['Disponible', 'Alerta', '🟢'], ['Activada', 'Alarma', '🟡'], ['Aproximandose', 'Aproximación', '🔵'],
      ['Interviniendo', 'Asistencia', '🔴'], ['Trasladando', 'Transporte', '💠'], ['Transfiriendo', 'Transferencia', '🟠'],
      ['Operativa', 'Reactivación', '🟢'], ['Inoperativa', 'Bloqueo', '⚫'],
    ])
  })
  it.each(DOCUMENT_STATUSES)('permite elegir %s desde cualquier otro estado sin secuencia obligatoria', status => {
    const { document, unit } = setup()
    const first = changeElementStatus(document, unit.id, status === 'Inoperativa' ? 'Activada' : 'Inoperativa', new Date())
    const before = structuredClone(first)
    const now = new Date(Date.now() + 1000)
    const changed = changeElementStatus(first, unit.id, status, now)
    expect(changed.elements[0]?.operational?.status).toBe(status)
    expect(changed.timeline.at(-1)).toMatchObject({ type: 'status-change', unitId: unit.id, unitName: 'Tango 1', previousStatus: first.elements[0]?.operational?.status, nextStatus: status, occurredAt: now.toISOString() })
    expect(changed.document.updatedAt).toBe(now.toISOString())
    expect(validateDocument(changed).success).toBe(true)
    expect(first).toEqual(before)
  })
  it('elegir el estado actual devuelve el mismo documento y no añade entrada ni fecha', () => {
    const { document, unit } = setup()
    const selected = changeElementStatus(document, unit.id, 'Disponible', new Date())
    expect(changeElementStatus(selected, unit.id, 'Disponible', new Date())).toBe(selected)
    expect(selected.timeline).toHaveLength(1)
  })
  it('rechaza generales, IDs inexistentes y estados desconocidos sin mutar', () => {
    const { document, general, unit } = setup(), before = structuredClone(document)
    expect(() => changeElementStatus(document, general.id, 'Activada', new Date())).toThrow()
    expect(() => changeElementStatus(document, crypto.randomUUID(), 'Activada', new Date())).toThrow()
    expect(() => changeElementStatus(document, unit.id, 'Otro' as 'Disponible', new Date())).toThrow()
    expect(document).toEqual(before)
  })
  it('ordena las entradas por instante completo incluso si el reloj retrocede', () => {
    const { document, unit } = setup(), now = Date.now()
    const first = changeElementStatus(document, unit.id, 'Activada', new Date(now + 1000))
    const second = changeElementStatus(first, unit.id, 'Aproximandose', new Date(now))
    expect(second.timeline.map(entry => entry.occurredAt)).toEqual([new Date(now).toISOString(), new Date(now + 1000).toISOString()])
  })
  it('inserta cambios antes de entradas importadas con fracciones más precisas que milisegundos', () => {
    const { document, unit } = setup()
    document.timeline = [{ id: crypto.randomUUID(), type: 'manual', revisions: [], text: 'Importada', occurredAt: '2026-01-01T12:00:00.0009Z' }]
    const changed = changeElementStatus(document, unit.id, 'Activada', new Date('2026-01-01T12:00:00.000Z'))
    expect(changed.timeline.map(entry => entry.type)).toEqual(['status-change', 'manual'])
    expect(validateDocument(changed).success).toBe(true)
  })
  it('guarda notas y normaliza etiquetas sin generar acontecimientos', () => {
    const { document, unit } = setup()
    setUnitNotes(document, unit.id, 'Canal 4\nRevisar acceso 🚧')
    addUnitTag(document, unit.id, '  Sector Norte  ')
    addUnitTag(document, unit.id, 'Radio')
    editUnitTag(document, unit.id, 0, '  Sector Sur  ')
    expect(document.elements[0]?.operational).toEqual({ status: null, currentEntryId: null, notes: 'Canal 4\nRevisar acceso 🚧', tags: ['Sector Sur', 'Radio'] })
    expect(() => addUnitTag(document, unit.id, 'sector sur')).toThrow()
    expect(() => addUnitTag(document, unit.id, '   ')).toThrow()
    expect(() => editUnitTag(document, unit.id, 1, ' SECTOR SUR ')).toThrow()
    expect(() => editUnitTag(document, unit.id, 0, '')).toThrow()
    editUnitTag(document, unit.id, 0, 'SECTOR SUR')
    removeUnitTag(document, unit.id, 1)
    expect(document.elements[0]?.operational?.tags).toEqual(['SECTOR SUR'])
    expect(document.timeline).toEqual([])
    expect(validateDocument(document).success).toBe(true)
  })
})
