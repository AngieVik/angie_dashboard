import { useId, useState } from 'react'
import type { AssetId, DocumentElement, ElementVisual } from '../../domain/document/types'
import type { CreateElementInput } from './elementTypes'
import { getPinBox, ICON_CATALOG } from './iconCatalog'
import { clampAssetScale } from './elementCommands'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { useAutoGrowingTextarea } from '../notebook/useAutoGrowingTextarea'

export function ElementEditor({ element, onSave, onCancel }: {
  element?: DocumentElement; onSave: (input: CreateElementInput) => void; onCancel: () => void
}) {
  const { blocked, blockedRef } = useViewportInteraction()
  const [name, setName] = useState(element?.name ?? '')
  const [information, setInformation] = useState(element?.information ?? '')
  const informationRef = useAutoGrowingTextarea(information)
  const nameId = useId()
  const [isUnit, setIsUnit] = useState(element?.isUnit ?? false)
  const [representation, setRepresentation] = useState(element?.visual.type ?? 'asset')
  const [assetId, setAssetId] = useState<AssetId>(element?.visual.type === 'asset' ? element.visual.assetId : 'ambulance')
  const [emoji, setEmoji] = useState(element?.visual.type === 'emoji' ? element.visual.value : '')
  const savedScale = element?.visual.scale ?? 1
  const [draftScale, setDraftScale] = useState({ source: savedScale, value: savedScale })
  // A direct pin resize replaces only the scale; other draft fields stay intact.
  if (draftScale.source !== savedScale) setDraftScale({ source: savedScale, value: savedScale })
  const scale = draftScale.source === savedScale ? draftScale.value : savedScale
  const [error, setError] = useState<string | null>(null)
  const visual: ElementVisual = representation === 'asset' ? { type: 'asset', assetId, scale } : { type: 'emoji', value: emoji, scale }
  const box = getPinBox(visual)
  return <form className="element-editor" aria-label={element ? 'Modificar elemento' : 'Añadir elemento'} onSubmit={event => {
    event.preventDefault()
    if (blockedRef.current) return
    if (!name.trim()) { setError('El nombre no puede estar vacío.'); return }
    if (representation === 'emoji' && !emoji.length) { setError('Escribe o pega un emoji.'); return }
    onSave({ name, information, visual, isUnit: element?.isUnit ?? isUnit })
  }}>
    <fieldset disabled={blocked}>
      <div className="element-name-row"><label htmlFor={nameId}>Nombre</label>
      {element ? <p className="element-type">Tipo: {element.isUnit ? 'Dotación' : 'General'}</p> :
        <label className="element-unit-choice"><input type="checkbox" checked={isUnit} onChange={event => setIsUnit(event.target.checked)} />Dotación</label>}</div>
      <Input id={nameId} aria-label="Nombre" autoFocus value={name} onChange={event => setName(event.target.value)} />
      <label>Representación<select aria-label="Representación" value={representation} onChange={event => setRepresentation(event.target.value as 'asset' | 'emoji')}>
        <option value="asset">Icono PNG</option><option value="emoji">Emoji</option>
      </select></label>
      {representation === 'asset' ? <>
        <label>Icono<select aria-label="Icono" value={assetId} onChange={event => setAssetId(event.target.value as AssetId)}>
          {Object.values(ICON_CATALOG).map(icon => <option key={icon.id} value={icon.id}>{icon.name}</option>)}
        </select></label>
      </> : <label>Emoji<Input aria-label="Emoji" value={emoji} onChange={event => setEmoji(event.target.value)} placeholder="Escribe o pega cualquier emoji" /></label>}
      <div className="element-preview" role="img" aria-label="Previsualización del elemento">
        <div className="element-preview-scene" style={{ width: box.width + 12, height: box.height + 12 }}>
          <div className="element-preview-pin" style={{ width: box.width, height: box.height }}>
            {visual.type === 'asset' ? <img src={ICON_CATALOG[visual.assetId].path} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center' }} /> :
              <span className="board-pin-emoji" style={{ fontSize: 48 * scale, lineHeight: `${64 * scale}px` }}>{visual.value}</span>}
            <span className="board-pin-name" style={{ fontSize: 16 * scale, lineHeight: `${20 * scale}px`, maxWidth: 200 * scale, padding: `${scale}px ${4 * scale}px` }}>{name}</span>
          </div>
        </div>
      </div>
      <label className="element-scale-control">Escala<input aria-label="Escala del icono" type="range" min="0.25" max="3" step="0.01" value={scale}
        onChange={event => setDraftScale({ source: savedScale, value: clampAssetScale(Number(event.target.value)) })} /><output className="technical-data" aria-label="Escala actual">{Math.round(scale * 100)} %</output></label>
      <label className="element-information">Información<textarea ref={informationRef} rows={1} aria-label="Información" value={information} onChange={event => setInformation(event.target.value)} /></label>
      {error && <p role="alert">{error}</p>}
      <div className="element-editor-actions"><Button type="submit">{element ? 'Guardar elemento' : 'Crear elemento'}</Button><Button onClick={onCancel}>Cancelar</Button></div>
    </fieldset>
  </form>
}
