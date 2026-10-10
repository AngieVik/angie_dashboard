import { useId, useRef, useState } from 'react'
import type { AssetId, DocumentElement, ElementVisual } from '../../domain/document/types'
import type { CreateElementInput } from './elementTypes'
import { getPinBox, ICON_CATALOG } from './iconCatalog'
import { clampAssetScale } from './elementCommands'
import { Input } from '../../components/ui/input'
import { Slider } from '../../components/ui/slider'
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group'
import { Textarea } from '../../components/ui/textarea'
import { useValidationNotice } from '../../components/ui/useValidationNotice'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { useAutoGrowingTextarea } from '../notebook/useAutoGrowingTextarea'

export function ElementEditor({ element, onSave, formId, isUnit = false }: {
  element?: DocumentElement; isUnit?: boolean; onSave: (input: CreateElementInput) => void; formId: string
}) {
  const { blocked, blockedRef } = useViewportInteraction()
  const [name, setName] = useState(element?.name ?? '')
  const [nameFontSize, setNameFontSize] = useState(element?.nameFontSize ?? 16)
  const [nameHidden, setNameHidden] = useState(element?.nameHidden ?? false)
  const [information, setInformation] = useState(element?.information ?? '')
  const informationRef = useAutoGrowingTextarea(information)
  const nameId = useId()
  const unit = element?.isUnit ?? isUnit
  const catalog: AssetId[] = unit ? ['ambulance', 'pathfinder', 'quad'] : ['checkpoint', 'hydration', 'start', 'finish', 'warning', 'pushpin']
  const [representation, setRepresentation] = useState(element?.visual.type ?? 'asset')
  const [assetId, setAssetId] = useState<AssetId>(element?.visual.type === 'asset' ? element.visual.assetId : catalog[0]!)
  const [emoji, setEmoji] = useState(element?.visual.type === 'emoji' ? element.visual.value : '')
  const savedScale = element?.visual.scale ?? 1
  const [draftScale, setDraftScale] = useState({ source: savedScale, value: savedScale })
  // Direct pin resizing synchronizes scale without replacing the other draft fields.
  if (draftScale.source !== savedScale) setDraftScale({ source: savedScale, value: savedScale })
  const scale = draftScale.source === savedScale ? draftScale.value : savedScale
  const setScale = (value: number) => { if (!blockedRef.current) setDraftScale({ source: savedScale, value: clampAssetScale(value) }) }
  const [error, setError] = useValidationNotice()
  const [errorField, setErrorField] = useState<'emoji' | null>(null)
  const visual: ElementVisual = representation === 'asset' ? { type: 'asset', assetId, scale } : { type: 'emoji', value: emoji, scale }
  const box = getPinBox(visual)
  return <form id={formId} className="element-editor" aria-label={element ? 'Modificar elemento' : 'Crear elemento'} onSubmit={event => {
    event.preventDefault()
    if (blockedRef.current) return
    if (representation === 'emoji' && !emoji.trim()) { setErrorField('emoji'); setError('Escribe o pega un emoji.'); return }
    onSave({ name, nameFontSize, nameHidden, information, visual, isUnit: unit })
  }}>
    <fieldset disabled={blocked}>
      <div className="element-editor-top">
        <Input id={nameId} placeholder="Nombre" aria-label="Nombre" autoFocus value={name} onChange={event => setName(event.target.value)} />
        <EditorNumber label="Tamaño de letra del nombre" min={8} max={72} value={nameFontSize} onValueChange={setNameFontSize} />
        <label className="element-name-hidden"><input type="checkbox" checked={nameHidden} onChange={event => setNameHidden(event.target.checked)} />Ocultar</label>
      </div>
      <RadioGroup aria-label="Tipo de pin" orientation="horizontal" value={representation} onValueChange={value => {
        if (!blockedRef.current) setRepresentation(value as 'asset' | 'emoji')
      }} disabled={blocked}>
        <label><RadioGroupItem value="asset" aria-label="PNG" />PNG</label>
        <label><RadioGroupItem value="emoji" aria-label="Emoji" />Emoji</label>
      </RadioGroup>
      {representation === 'asset' ? <label className="element-pin-choice">Pin<select aria-label="Pin" value={assetId} onChange={event => setAssetId(event.target.value as AssetId)}>
        {!catalog.includes(assetId) && <option value={assetId}>{ICON_CATALOG[assetId].name} (actual)</option>}
        {catalog.map(id => <option key={id} value={id}>{ICON_CATALOG[id].name}</option>)}
      </select></label> : <Input aria-label="Emoji" placeholder="Emoji" aria-invalid={Boolean(error && errorField === 'emoji')} aria-describedby={error && errorField === 'emoji' ? `${nameId}-error` : undefined} value={emoji} onChange={event => setEmoji(event.target.value)} />}
      <div className="element-preview" role="img" aria-label="Previsualización del elemento">
        <div className="element-preview-scene" style={{ width: Math.max(box.width, nameHidden ? 0 : Math.min(200 * scale, name.length * nameFontSize * .65 + 8)) + 12, height: Math.max(box.height, nameHidden ? 0 : nameFontSize * 1.25) + 12 }}>
          <div className="element-preview-pin" style={{ width: box.width, height: box.height }}>
            {visual.type === 'asset' ? <img src={ICON_CATALOG[visual.assetId].path} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center' }} /> :
              <span className="board-pin-emoji" style={{ fontSize: 48 * scale, lineHeight: `${64 * scale}px` }}>{visual.value}</span>}
            {!nameHidden && <span className="board-pin-name" style={{ fontSize: nameFontSize, lineHeight: `${nameFontSize * 1.25}px`, maxWidth: 200 * scale, padding: `${scale}px ${4 * scale}px` }}>{name}</span>}
          </div>
        </div>
      </div>
      <div className="element-scale-control">
        <Slider label="Escala del icono" min={25} max={300} value={Math.round(scale * 100)} onValueChange={value => setScale(value / 100)} disabled={blocked} />
        <EditorNumber label="Escala" min={25} max={300} value={Math.round(scale * 100)} onValueChange={value => setScale(value / 100)} /><span aria-hidden="true">%</span>
      </div>
      <Textarea ref={informationRef} rows={1} aria-label="Información" placeholder="Información" value={information} onChange={event => setInformation(event.target.value)} />
      {error && <p id={`${nameId}-error`} role="alert">{error}</p>}
    </fieldset>
  </form>
}


function EditorNumber({ label, value, onValueChange, min, max }: {
  label: string; value: number; onValueChange: (value: number) => void; min: number; max: number
}) {
  const [draft, setDraft] = useState<{ source: number; text: string } | null>(null)
  const origin = useRef(value)
  // A slider or direct pin resize supersedes an unfinished numeric draft.
  if (draft && draft.source !== value) setDraft(null)
  function commit() {
    if (draft?.text.trim() && Number.isFinite(Number(draft.text))) onValueChange(Math.max(min, Math.min(max, Number(draft.text))))
    setDraft(null)
  }
  return <Input type="number" inputMode="decimal" aria-label={label} title={label} min={min} max={max}
    value={draft?.text ?? value} onFocus={() => { origin.current = value }} onChange={event => {
      const text = event.target.value, number = Number(text)
      const valid = Boolean(text.trim()) && Number.isFinite(number) && number >= min && number <= max
      setDraft({ source: valid ? number : value, text })
      if (valid) onValueChange(number)
    }} onBlur={commit} onKeyDown={event => {
      if (event.key === 'Enter') { event.preventDefault(); commit() }
      if (event.key === 'Escape') { event.preventDefault(); setDraft(null); onValueChange(origin.current) }
    }} />
}
