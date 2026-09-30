import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../../domain/document/defaultDocument'
import { serializeDocument } from '../../domain/document/serializeDocument'
import { validateDocument } from '../../domain/document/validateDocument'
import { clampAssetScale, clampPinPosition, createElement, updateElement, duplicateElement, deleteElement } from './elementCommands'

const input = { name: 'Tango 1', visual: { type: 'asset' as const, assetId: 'ambulance' as const, scale: 1 }, information: 'Canal 4', isUnit: true }

describe('comandos de elementos', () => {
  it('crea dotación Disponible y general con emoji libre sin datos operativos', () => {
    const document = createEmptyDocument()
    const unit = createElement(document, input)
    const general = createElement(document, { name: 'Ruta', information: '', isUnit: false, visual: { type: 'emoji', value: '🚴🏽‍♂️' } })
    expect(unit.operational).toEqual({ status: 'Disponible', notes: '', tags: [] })
    expect(unit.position).toEqual({ x: 500, y: 500 })
    expect(unit.id).not.toBe(general.id)
    expect(general).toMatchObject({ isUnit: false, operational: null, visual: { type: 'emoji', value: '🚴🏽‍♂️' } })
    expect(validateDocument(document).success).toBe(true)
  })
  it('rechaza nombres vacíos, emojis vacíos y números no finitos sin alterar el documento', () => {
    const document = createEmptyDocument()
    expect(() => createElement(document, { ...input, name: '   ' })).toThrow()
    expect(() => createElement(document, { ...input, visual: { type: 'emoji', value: '' } })).toThrow()
    expect(() => createElement(document, { ...input, position: { x: Infinity, y: 4 } })).toThrow()
    expect(document.elements).toEqual([])
  })
  it('edita únicamente configuración común y posición; no permite cambiar Dotación en ningún sentido', () => {
    const document = createEmptyDocument()
    const unit = createElement(document, input)
    const general = createElement(document, { ...input, isUnit: false })
    updateElement(document, unit.id, { name: 'Tango 2', information: 'Canal 5', visual: { type: 'emoji', value: '🚁' } })
    expect(document.elements[0]).toMatchObject({ name: 'Tango 2', information: 'Canal 5', isUnit: true, visual: { type: 'emoji', value: '🚁' } })
    expect(() => updateElement(document, unit.id, { isUnit: false } as never)).toThrow()
    expect(() => updateElement(document, general.id, { isUnit: true } as never)).toThrow()
    expect(document.elements.map(element => element.isUnit)).toEqual([true, false])
  })
  it('limita escala y recoloca el centro utilizando la caja completa escalada', () => {
    expect(clampAssetScale(0.1)).toBe(0.25)
    expect(clampAssetScale(4)).toBe(3)
    expect(clampAssetScale(1.75)).toBe(1.75)
    expect(() => clampAssetScale(NaN)).toThrow()
    expect(clampPinPosition({ x: 999, y: -10 }, { type: 'asset', assetId: 'ambulance', scale: 3 })).toEqual({ x: 775, y: 150 })
    const document = createEmptyDocument()
    const unit = createElement(document, { ...input, position: { x: 925, y: 950 } })
    updateElement(document, unit.id, { visual: { type: 'asset', assetId: 'ambulance', scale: 3 } })
    expect(document.elements[0]?.position).toEqual({ x: 775, y: 850 })
    expect(JSON.parse(serializeDocument(document)).elements[0].visual.scale).toBe(3)
  })
  it('duplica con UUID y nombre nuevos, desplaza 24 y reinicia la operación sin copiar historial', () => {
    const document = createEmptyDocument()
    const unit = createElement(document, { ...input, visual: { ...input.visual, scale: 2 }, position: { x: 500, y: 500 } })
    if (!unit.isUnit) throw new Error('dotación esperada')
    unit.operational = { status: 'En camino', notes: 'Acceso norte', tags: ['Radio'] }
    document.timeline.push({ id: crypto.randomUUID(), type: 'status-change', occurredAt: document.document.createdAt, unitId: unit.id, unitName: unit.name, previousStatus: 'Disponible', nextStatus: 'En camino' })
    const history = structuredClone(document.timeline)
    const copy = duplicateElement(document, unit.id)
    expect(copy.id).not.toBe(unit.id)
    expect(copy).toMatchObject({ name: 'Tango 1 copia', visual: unit.visual, information: unit.information, isUnit: true, position: { x: 524, y: 524 }, operational: { status: 'Disponible', notes: '', tags: [] } })
    expect(document.timeline).toEqual(history)
    deleteElement(document, unit.id)
    expect(document.elements.map(element => element.id)).toEqual([copy.id])
    expect(document.timeline).toEqual(history)
    expect(validateDocument(document).success).toBe(true)
  })
  it('duplica generales, conserva null y limita la copia en los bordes', () => {
    const document = createEmptyDocument()
    const general = createElement(document, { ...input, isUnit: false, position: null })
    expect(duplicateElement(document, general.id)).toMatchObject({ isUnit: false, operational: null, position: null })
    updateElement(document, general.id, { position: { x: 999, y: 999 } })
    expect(duplicateElement(document, general.id).position).toEqual({ x: 925, y: 950 })
  })
})
