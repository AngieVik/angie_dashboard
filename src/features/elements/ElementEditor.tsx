import { useState } from 'react'
import type { AssetId, DocumentElement, ElementVisual } from '../../domain/document/types'
import type { CreateElementInput } from './elementTypes'
import { ICON_CATALOG } from './iconCatalog'
import { clampAssetScale } from './elementCommands'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { useViewportInteraction } from '../../layout/ViewportContext'

export function ElementEditor({ element, onSave, onCancel, onScale }: {
  element?: DocumentElement; onSave: (input: CreateElementInput) => void; onCancel: () => void; onScale: (scale: number) => void
}) {
  const { blocked, blockedRef } = useViewportInteraction()
  const [name, setName] = useState(element?.name ?? '')
  const [information, setInformation] = useState(element?.information ?? '')
  const [isUnit, setIsUnit] = useState(element?.isUnit ?? false)
  const [representation, setRepresentation] = useState(element?.visual.type ?? 'asset')
  const [assetId, setAssetId] = useState<AssetId>(element?.visual.type === 'asset' ? element.visual.assetId : 'ambulance')
  const [emoji, setEmoji] = useState(element?.visual.type === 'emoji' ? element.visual.value : '')
  const [localScale, setLocalScale] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const scale = element?.visual.scale ?? localScale
  return <form className="element-editor" aria-label={element ? 'Modificar elemento' : 'Añadir elemento'} onSubmit={event => {
    event.preventDefault()
    if (blockedRef.current) return
    if (!name.trim()) { setError('El nombre no puede estar vacío.'); return }
    if (representation === 'emoji' && !emoji.length) { setError('Escribe o pega un emoji.'); return }
    const visual: ElementVisual = representation === 'asset' ? { type: 'asset', assetId, scale } : { type: 'emoji', value: emoji, scale }
    onSave({ name, information, visual, isUnit: element?.isUnit ?? isUnit })
  }}>
    <fieldset disabled={blocked}>
      <legend>{element ? 'Modificar elemento' : 'Añadir elemento'}</legend>
      <label>Nombre<Input aria-label="Nombre" autoFocus value={name} onChange={event => setName(event.target.value)} /></label>
      {element ? <p className="element-type">Tipo: {element.isUnit ? 'Dotación' : 'General'}</p> :
        <label className="element-unit-choice"><input type="checkbox" checked={isUnit} onChange={event => setIsUnit(event.target.checked)} />Dotación</label>}
      <label>Representación<select aria-label="Representación" value={representation} onChange={event => setRepresentation(event.target.value as 'asset' | 'emoji')}>
        <option value="asset">Icono PNG</option><option value="emoji">Emoji</option>
      </select></label>
      {representation === 'asset' ? <>
        <label>Icono<select aria-label="Icono" value={assetId} onChange={event => setAssetId(event.target.value as AssetId)}>
          {Object.values(ICON_CATALOG).map(icon => <option key={icon.id} value={icon.id}>{icon.name}</option>)}
        </select></label>
        <img className="element-icon-preview" src={ICON_CATALOG[assetId].path} alt={ICON_CATALOG[assetId].name} />
        <label className="element-scale-control">Escala<input aria-label="Escala del icono" type="range" min="0.25" max="3" step="0.01" value={scale} onChange={event => {
          const next = clampAssetScale(Number(event.target.value))
          if (element?.visual.type === 'asset') onScale(next)
          else setLocalScale(next)
        }} /><output className="technical-data" aria-label="Escala actual">{Math.round(scale * 100)} %</output></label>
      </> : <label>Emoji<Input aria-label="Emoji" value={emoji} onChange={event => setEmoji(event.target.value)} placeholder="Escribe o pega cualquier emoji" /></label>}
      <label>Información<textarea aria-label="Información" value={information} onChange={event => setInformation(event.target.value)} /></label>
      {error && <p role="alert">{error}</p>}
      <div className="element-editor-actions"><Button type="submit">{element ? 'Guardar elemento' : 'Crear elemento'}</Button><Button onClick={onCancel}>Cancelar</Button></div>
    </fieldset>
  </form>
}
