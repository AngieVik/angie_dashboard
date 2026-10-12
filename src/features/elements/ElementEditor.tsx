import { useId, useState } from 'react'
import type { AssetId, DocumentElement, ElementVisual, PinNameColor } from '../../domain/document/types'
import type { CreateElementInput } from './elementTypes'
import { getPinBox, ICON_CATALOG } from './iconCatalog'
import { clampAssetScale } from './elementCommands'
import { getPinNameLayout, PIN_NAME_COLORS, pinNameLines, pinNameStyle, pinTransform } from './pinPresentation'
import { Button } from '../../components/ui/button'
import { FlipHorizontal2, FlipVertical2 } from 'lucide-react'
import { Input } from '../../components/ui/input'
import { Slider } from '../../components/ui/slider'
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group'
import { Textarea } from '../../components/ui/textarea'
import { useValidationNotice } from '../../components/ui/useValidationNotice'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { useAutoGrowingTextarea } from '../notebook/useAutoGrowingTextarea'

export function ElementEditor({ element, onSave, formId, isUnit = false, creating = !element }: {
  element?: DocumentElement; isUnit?: boolean; creating?: boolean; onSave: (input: CreateElementInput, keepOpen: boolean) => void; formId: string
}) {
  const { blocked, blockedRef } = useViewportInteraction()
  const [name, setName] = useState(element?.name ?? '')
  const [nameFontSize, setNameFontSize] = useState(element?.nameFontSize ?? 16)
  const [nameHidden, setNameHidden] = useState(element?.nameHidden ?? false)
  const [draftNameColor, setDraftNameColor] = useState<PinNameColor | null>(null)
  const [information, setInformation] = useState(element?.information ?? '')
  const informationRef = useAutoGrowingTextarea(information)
  const nameId = useId()
  const unit = element?.isUnit ?? isUnit
  const catalog: AssetId[] = unit ? ['ambulance', 'pathfinder', 'quad'] : ['checkpoint', 'hydration', 'start', 'finish', 'warning', 'pushpin']
  const [representation, setRepresentation] = useState(element?.visual.type ?? 'asset')
  const [assetId, setAssetId] = useState<AssetId>(element?.visual.type === 'asset' ? element.visual.assetId : catalog[0]!)
  const [emoji, setEmoji] = useState(element?.visual.type === 'emoji' ? element.visual.value : '')
  const [rotation, setRotation] = useState(element?.visual.rotation ?? 0)
  const [flipX, setFlipX] = useState(element?.visual.flipX ?? false)
  const [flipY, setFlipY] = useState(element?.visual.flipY ?? false)
  const savedScale = element?.visual.scale ?? 1
  const [draftScale, setDraftScale] = useState({ source: savedScale, value: savedScale })
  // Direct pin resizing synchronizes scale without replacing the other draft fields.
  if (draftScale.source !== savedScale) setDraftScale({ source: savedScale, value: savedScale })
  const scale = draftScale.source === savedScale ? draftScale.value : savedScale
  const setScale = (value: number) => { if (!blockedRef.current) setDraftScale({ source: savedScale, value: clampAssetScale(value) }) }
  const [error, setError] = useValidationNotice()
  const [errorField, setErrorField] = useState<'emoji' | null>(null)
  const transforms = { ...(rotation || element?.visual.rotation !== undefined ? { rotation } : {}),
    ...(flipX || element?.visual.flipX !== undefined ? { flipX } : {}), ...(flipY || element?.visual.flipY !== undefined ? { flipY } : {}) }
  const visual: ElementVisual = representation === 'asset' ? { type: 'asset', assetId, scale, ...transforms } : { type: 'emoji', value: emoji, scale, ...transforms }
  const box = getPinBox(visual)
  const nameColor = draftNameColor ?? element?.nameColor
  const nameOffset = element?.nameOffset
  const nameElement = { name, visual, nameFontSize, nameOffset, nameColor }
  const nameLines = pinNameLines(name)
  const label = getPinNameLayout(nameElement, Math.min(200 * scale, Math.max(...nameLines.map(line => [...line].length)) * nameFontSize * .65 + 8 * scale))
  // Keep a fixed rotation envelope and anchor the label to the preview's bottom edge.
  const diameter = Math.hypot(box.width, box.height)
  const previewWidth = Math.max(diameter, nameHidden ? 0 : label.width)
  const previewHeight = diameter + (nameHidden ? 0 : nameFontSize * 1.25 * nameLines.length)
  return <form id={formId} className="element-editor" aria-label={creating ? 'Crear elemento' : 'Modificar elemento'} onSubmit={event => {
    event.preventDefault()
    if (blockedRef.current) return
    if (representation === 'emoji' && !emoji.trim()) { setErrorField('emoji'); setError('Escribe o pega un emoji.'); return }
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    onSave({ name, nameFontSize, nameHidden, nameOffset, nameColor, information, visual, isUnit: unit }, submitter instanceof HTMLButtonElement && submitter.value === 'apply')
  }}>
    <fieldset disabled={blocked}>
      <div className="element-editor-top">
        <Input id={nameId} placeholder="Nombre" aria-label="Nombre" autoFocus value={name} onChange={event => setName(event.target.value)} />
        {!nameHidden && <span className="element-name-size-control" title={`Tamaño de letra: ${nameFontSize} px`}>
          <Slider label="Tamaño de letra del nombre" min={8} max={72} value={nameFontSize} onValueChange={value => { if (!blockedRef.current) setNameFontSize(value) }} disabled={blocked} />
        </span>}
        <label className="element-name-hidden"><input type="checkbox" checked={nameHidden} onChange={event => setNameHidden(event.target.checked)} />Ocultar</label>
      </div>
      <RadioGroup aria-label="Tipo de pin" orientation="horizontal" value={representation} onValueChange={value => {
        if (!blockedRef.current) setRepresentation(value as 'asset' | 'emoji')
      }} disabled={blocked}>
        <label><RadioGroupItem value="asset" aria-label="PNG" />PNG</label>
        <label><RadioGroupItem value="emoji" aria-label="Emoji" />Emoji</label>
      </RadioGroup>
      {representation === 'asset' ? <label className="element-pin-choice">PIN<select aria-label="PIN" value={assetId} onChange={event => setAssetId(event.target.value as AssetId)}>
        {!catalog.includes(assetId) && <option value={assetId}>{ICON_CATALOG[assetId].name} (actual)</option>}
        {catalog.map(id => <option key={id} value={id}>{ICON_CATALOG[id].name}</option>)}
      </select></label> : <Input aria-label="Emoji" placeholder="Emoji" aria-invalid={Boolean(error && errorField === 'emoji')} aria-describedby={error && errorField === 'emoji' ? `${nameId}-error` : undefined} value={emoji} onChange={event => setEmoji(event.target.value)} />}
      <div className="element-preview" role="img" aria-label="Previsualización del elemento">
        <div className="element-preview-scene" style={{ width: previewWidth, height: previewHeight }}>
          <div className="element-preview-pin" style={{ position: 'absolute', left: (previewWidth - box.width) / 2, top: (diameter - box.height) / 2, width: box.width, height: box.height }}>
            {visual.type === 'asset' ? <img src={ICON_CATALOG[visual.assetId].path} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', transform: pinTransform(visual) }} /> :
              <span className="board-pin-emoji" style={{ display: 'block', fontSize: 48 * scale, lineHeight: `${64 * scale}px`, transform: pinTransform(visual) }}>{visual.value}</span>}
          </div>
          {!nameHidden && <span className="board-pin-name" title={name} style={{ ...pinNameStyle(nameElement), left: '50%', top: 'auto', bottom: 0, transform: 'translateX(-50%)', paddingBlock: 0 }}>{nameLines.join('\n')}</span>}
        </div>
      </div>
      {!nameHidden && <div className="element-name-controls">
        <div className="element-name-colors" role="group" aria-label="Colores del nombre">
          {(Object.entries(PIN_NAME_COLORS) as [PinNameColor, typeof PIN_NAME_COLORS[PinNameColor]][]).map(([color, theme]) =>
            <button key={color} type="button" aria-label={theme.label} title={theme.label} aria-pressed={(nameColor ?? 'dark') === color}
              style={{ backgroundColor: theme.backgroundColor, color: theme.color }} onClick={() => {
                if (!blockedRef.current) setDraftNameColor(color)
              }}>Aa</button>)}
        </div>
      </div>}
      <div className="element-scale-control">
        <div className="element-slider-row">
          <span>Escala</span>
          <Slider label="Escala del icono" min={25} max={300} value={Math.round(scale * 100)} onValueChange={value => setScale(value / 100)} disabled={blocked} />
          <output aria-label="Escala actual">{Math.round(scale * 100)} %</output>
        </div>
        <div className="element-slider-row">
          <span>Giro</span>
          <Slider label="Giro del pin" min={0} max={360} value={rotation} onValueChange={value => { if (!blockedRef.current) setRotation(value) }} disabled={blocked} />
          <output aria-label="Giro actual">{rotation}°</output>
          <div className="element-transform-controls">
            <Button aria-label="Invertir horizontalmente" title="Invertir horizontalmente" aria-pressed={flipX} onClick={() => { if (!blockedRef.current) setFlipX(value => !value) }}><FlipHorizontal2 aria-hidden="true" /></Button>
            <Button aria-label="Invertir verticalmente" title="Invertir verticalmente" aria-pressed={flipY} onClick={() => { if (!blockedRef.current) setFlipY(value => !value) }}><FlipVertical2 aria-hidden="true" /></Button>
          </div>
        </div>
      </div>
      <Textarea ref={informationRef} rows={1} aria-label="Información" placeholder="Información" value={information} onChange={event => setInformation(event.target.value)} />
      {error && <p id={`${nameId}-error`} role="alert">{error}</p>}
    </fieldset>
  </form>
}
