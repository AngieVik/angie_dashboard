import { Checkbox } from '@/components/ui/checkbox'
import { Select } from '@/components/ui/select'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { AssetId, DocumentElement, ElementVisual, PinAnchor, PinNameColor, Position } from '../../domain/document/types'
import type { CreateElementInput, ElementBatchPatch } from './elementTypes'
import { getPinBox, ICON_CATALOG } from './iconCatalog'
import { clampAssetScale } from './elementCommands'
import { getPinAnchorFromPoint, getPinAnchorPoint, getPinNameLayout, PIN_NAME_COLORS, pinNameLines, pinNameStyle, pinTransform } from './pinPresentation'
import { Button } from '@/components/ui/button'
import { AArrowDown, AArrowUp, Crosshair, RotateCcw, RotateCw, TrianglesCenterlineDashedHorizontal, TrianglesCenterlineDashedVertical } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { useValidationNotice } from '@/hooks/useValidationNotice'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { useAutoGrowingTextarea } from '../notebook/useAutoGrowingTextarea'
import pinStyles from './BoardPin.module.css'

type ElementEditorProps = {
  element?: DocumentElement; isUnit?: boolean; creating?: boolean; formId: string
} & ({
  onSave: (input: CreateElementInput, keepOpen: boolean) => void; onSaveBatch?: never; batchCount?: never
} | {
  onSave?: never; onSaveBatch: (patch: ElementBatchPatch, keepOpen: boolean) => void; batchCount: number
})

export function ElementEditor({ element, onSave, onSaveBatch, batchCount, formId, isUnit = false, creating = !element }: ElementEditorProps) {
  const { blocked, blockedRef } = useViewportInteraction()
  const changed = useRef(new Set<'icon' | 'scale' | 'rotation' | 'flipX' | 'flipY' | 'nameFontSize' | 'nameHidden' | 'nameColor' | 'pinAnchor'>())
  const [pinAnchor, setPinAnchor] = useState<PinAnchor>(element?.pinAnchor ?? 'center')
  const previewPin = useRef<HTMLDivElement>(null)
  const anchorGesture = useRef<{ pointerId: number; next: Position | null } | null>(null)
  const [anchorPreview, setAnchorPreview] = useState<Position | null>(null)
  const cancelAnchorGesture = useCallback(() => { anchorGesture.current = null; setAnchorPreview(null) }, [])
  useEffect(() => {
    if (blocked) {
      // Discard the draft when the viewport takes over a multi-pointer gesture.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      cancelAnchorGesture()
    }
  }, [blocked, cancelAnchorGesture])
  const [name, setName] = useState(element?.name ?? '')
  const [nameFontSize, setNameFontSize] = useState(element?.nameFontSize ?? 16)
  const [nameSizeText, setNameSizeText] = useState<string | null>(null)
  const setNameSize = (value: number) => {
    if (blockedRef.current || !Number.isFinite(value)) return
    changed.current.add('nameFontSize'); setNameFontSize(Math.max(8, Math.min(72, value))); setNameSizeText(null)
  }
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
  const [scaleText, setScaleText] = useState<string | null>(null)
  // Direct pin resizing synchronizes scale without replacing the other draft fields.
  if (draftScale.source !== savedScale) { setDraftScale({ source: savedScale, value: savedScale }); setScaleText(null) }
  const scale = draftScale.source === savedScale ? draftScale.value : savedScale
  const scaleValue = Number((1 + (scale - .25) * 99 / 3.75).toFixed(4))
  const setScale = (value: number) => { if (!blockedRef.current && Number.isFinite(value)) { changed.current.add('scale'); setDraftScale({ source: savedScale, value: clampAssetScale(value) }); setScaleText(null) } }
  const [error, setError] = useValidationNotice()
  const [errorField, setErrorField] = useState<'emoji' | null>(null)
  const transforms = { ...(rotation || element?.visual.rotation !== undefined ? { rotation } : {}),
    ...(flipX || element?.visual.flipX !== undefined ? { flipX } : {}), ...(flipY || element?.visual.flipY !== undefined ? { flipY } : {}) }
  const visual: ElementVisual = representation === 'asset' ? { type: 'asset', assetId, scale, ...transforms } : { type: 'emoji', value: emoji, scale, ...transforms }
  const previewVisual = { ...visual, scale: 1 }
  const box = getPinBox(previewVisual)
  const anchorPoint = getPinAnchorPoint(previewVisual, blocked ? pinAnchor : anchorPreview ?? pinAnchor)
  function previewAnchor(event: PointerEvent<HTMLButtonElement>) {
    const gesture = anchorGesture.current, rect = previewPin.current?.getBoundingClientRect()
    if (!gesture || gesture.pointerId !== event.pointerId || blockedRef.current || !rect?.width || !rect.height) return
    // Client bounds include module/global zoom; convert back to preview pixels.
    const next = getPinAnchorFromPoint(previewVisual, { x: (event.clientX - rect.left) * box.width / rect.width,
      y: (event.clientY - rect.top) * box.height / rect.height })
    gesture.next = next
    setAnchorPreview(next)
  }
  const nameColor = draftNameColor ?? element?.nameColor
  const nameOffset = element?.nameOffset
  // Normalize the preview to a fixed pin while preserving the saved title/pin ratio.
  const previewNameFontSize = nameFontSize / scale
  const nameElement = { name, visual: previewVisual, nameFontSize: previewNameFontSize, nameOffset, nameColor }
  const nameLines = pinNameLines(name)
  const label = getPinNameLayout(nameElement, Math.min(200, Math.max(...nameLines.map(line => [...line].length)) * previewNameFontSize * .65 + 8))
  // Keep a fixed rotation envelope and anchor the label to the preview's bottom edge.
  const diameter = Math.hypot(box.width, box.height)
  const previewWidth = Math.max(diameter, nameHidden ? 0 : label.width)
  const previewHeight = diameter + (nameHidden ? 0 : previewNameFontSize * 1.25 * nameLines.length)
  return <form id={formId} className="element-editor" aria-label={onSaveBatch ? 'Modificar selección' : creating ? 'Crear elemento' : 'Modificar elemento'} onSubmit={event => {
    event.preventDefault()
    if (blockedRef.current) return
    if (representation === 'emoji' && !emoji.trim() && (!onSaveBatch || changed.current.has('icon'))) { setErrorField('emoji'); setError('Escribe o pega un emoji.'); return }
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const keepOpen = submitter instanceof HTMLButtonElement && submitter.value === 'apply'
    if (onSaveBatch) {
      const fields = changed.current
      const visualPatch: ElementBatchPatch['visual'] = {
        ...(fields.has('icon') ? { icon: visual.type === 'asset' ? { type: 'asset', assetId: visual.assetId } as const : { type: 'emoji', value: visual.value } as const } : {}),
        ...(fields.has('scale') ? { scale } : {}), ...(fields.has('rotation') ? { rotation } : {}),
        ...(fields.has('flipX') ? { flipX } : {}), ...(fields.has('flipY') ? { flipY } : {}),
      }
      onSaveBatch({ ...(fields.has('nameFontSize') ? { nameFontSize } : {}),
        ...(fields.has('nameHidden') ? { nameHidden } : {}), ...(fields.has('nameColor') ? { nameColor } : {}),
        ...(fields.has('pinAnchor') ? { pinAnchor } : {}),
        ...(Object.keys(visualPatch).length ? { visual: visualPatch } : {}) }, keepOpen)
      fields.clear()
    } else onSave?.({ name, nameFontSize, nameHidden, nameOffset, nameColor, pinAnchor: pinAnchor === 'center' && !element?.pinAnchor ? undefined : pinAnchor,
      information, visual, isUnit: unit }, keepOpen)
  }}>
    <fieldset disabled={blocked}>
      {onSaveBatch && <p className="element-batch-summary">{batchCount} pines · Solo controles modificados</p>}
      <div className="element-editor-top">
        {!onSaveBatch && <Input id={nameId} placeholder="Nombre" aria-label="Nombre" autoFocus value={name} onChange={event => setName(event.target.value)} />}
        {!nameHidden && <span className="element-name-size-control element-value-control" role="group" aria-label="Tamaño de letra del nombre">
          <Button aria-label="Reducir tamaño de letra" title="Reducir tamaño de letra" disabled={blocked || nameFontSize <= 8} onClick={() => setNameSize(nameFontSize - 1)}><AArrowDown aria-hidden="true" /></Button>
          <Input type="number" inputMode="decimal" aria-label="Tamaño de letra del nombre" min={8} max={72} step="any" required value={nameSizeText ?? nameFontSize} onChange={event => {
            if (blockedRef.current) return
            const value = event.target.valueAsNumber
            if (Number.isFinite(value) && value >= 8 && value <= 72) setNameSize(value)
            setNameSizeText(event.target.value)
          }} onBlur={event => {
            if (nameSizeText !== null && event.target.value !== '') setNameSize(event.target.valueAsNumber)
            setNameSizeText(null)
          }} />
          <Button aria-label="Aumentar tamaño de letra" title="Aumentar tamaño de letra" disabled={blocked || nameFontSize >= 72} onClick={() => setNameSize(nameFontSize + 1)}><AArrowUp aria-hidden="true" /></Button>
        </span>}
        <label className="element-name-hidden"><Checkbox disabled={blocked} checked={nameHidden} onCheckedChange={nextChecked => { changed.current.add('nameHidden'); setNameHidden(nextChecked) }} />Ocultar</label>
      </div>
      <RadioGroup aria-label="Tipo de pin" orientation="horizontal" value={representation} onValueChange={value => {
        if (!blockedRef.current) { changed.current.add('icon'); setRepresentation(value as 'asset' | 'emoji') }
      }} disabled={blocked}>
        <label><RadioGroupItem value="asset" aria-label="PNG" />PNG</label>
        <label><RadioGroupItem value="emoji" aria-label="Emoji" />Emoji</label>
      </RadioGroup>
      {representation === 'asset' ? <label className="element-pin-choice">PIN<Select aria-label="PIN" value={assetId} disabled={blocked}
        onValueChange={value => { changed.current.add('icon'); setAssetId(value as AssetId) }}
        options={[...(!catalog.includes(assetId) ? [{ value: assetId, label: ICON_CATALOG[assetId].name + ' (actual)' }] : []), ...catalog.map(id => ({ value: id, label: ICON_CATALOG[id].name }))]} />
      </label> : <Input aria-label="Emoji" placeholder="Emoji" aria-invalid={Boolean(error && errorField === 'emoji')} aria-describedby={error && errorField === 'emoji' ? `${nameId}-error` : undefined} value={emoji} onChange={event => { changed.current.add('icon'); setEmoji(event.target.value) }} />}
      <div className="element-preview-frame">
        <div className="element-preview" role="img" aria-label="Previsualización del elemento">
          <div className="element-preview-scene" style={{ width: previewWidth, height: previewHeight }}>
            <div ref={previewPin} className="element-preview-pin" style={{ position: 'absolute', left: (previewWidth - box.width) / 2, top: (diameter - box.height) / 2, width: box.width, height: box.height }}>
              {visual.type === 'asset' ? <img src={ICON_CATALOG[visual.assetId].path} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', transform: pinTransform(visual) }} /> :
                <span className="board-pin-emoji" style={{ display: 'block', fontSize: 48, lineHeight: '64px', transform: pinTransform(visual) }}>{visual.value}</span>}
            </div>
            {!nameHidden && <span className={`board-pin-name ${pinStyles.name}`} title={name} style={{ ...pinNameStyle(nameElement), left: '50%', top: 'auto', bottom: 0, transform: 'translateX(-50%)', paddingBlock: 0 }}>{nameLines.join('\n')}</span>}
            <Crosshair className="element-anchor-mark" aria-hidden="true" style={{ left: (previewWidth - box.width) / 2 + anchorPoint.x, top: (diameter - box.height) / 2 + anchorPoint.y }} />
          </div>
        </div>
        <button type="button" className="element-anchor-picker" aria-label="Punto de coordenadas" title="Punto de coordenadas"
          aria-description="Arrastra o usa las flechas. Mayús para ajuste fino." style={{ height: diameter + 2 }} disabled={blocked}
          onPointerDown={event => {
            if (blockedRef.current || event.isPrimary === false || anchorGesture.current) { cancelAnchorGesture(); return }
            if (event.button !== 0) return
            event.preventDefault(); event.stopPropagation()
            event.currentTarget.focus({ preventScroll: true })
            event.currentTarget.setPointerCapture?.(event.pointerId)
            anchorGesture.current = { pointerId: event.pointerId, next: null }
            previewAnchor(event)
          }} onPointerMove={previewAnchor} onPointerUp={event => {
            if (anchorGesture.current?.pointerId !== event.pointerId) return
            if (!blockedRef.current) {
              previewAnchor(event)
              const next = anchorGesture.current?.next
              if (next) { changed.current.add('pinAnchor'); setPinAnchor(next) }
            }
            cancelAnchorGesture()
          }} onPointerCancel={cancelAnchorGesture} onLostPointerCapture={cancelAnchorGesture}
          onKeyDown={event => {
            if (blockedRef.current || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
            event.preventDefault(); event.stopPropagation()
            const step = event.shiftKey ? .1 : 1
            changed.current.add('pinAnchor')
            setPinAnchor(getPinAnchorFromPoint(previewVisual, {
              x: anchorPoint.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
              y: anchorPoint.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0),
            }))
          }} />
      </div>
      {!nameHidden && <div className="element-name-controls">
        <div className="element-name-colors" role="group" aria-label="Colores del nombre">
          {(Object.entries(PIN_NAME_COLORS) as [PinNameColor, typeof PIN_NAME_COLORS[PinNameColor]][]).map(([color, theme]) =>
            <button key={color} type="button" aria-label={theme.label} title={theme.label} aria-pressed={(nameColor ?? 'dark') === color}
              style={{ backgroundColor: theme.backgroundColor, color: theme.color }} onClick={() => {
                if (!blockedRef.current) { changed.current.add('nameColor'); setDraftNameColor(color) }
              }}>Aa</button>)}
        </div>
      </div>}
      <div className="element-scale-control">
        <div className="element-adjustment-row">
          <span>Escala</span>
          <div className="element-value-control" role="group" aria-label="Escala del icono">
            <Button aria-label="Reducir escala" title="Reducir escala" disabled={blocked || scaleValue <= 1} onClick={() => setScale(.25 + (scaleValue - 2) * 3.75 / 99)}><AArrowDown aria-hidden="true" /></Button>
            <Input type="number" inputMode="decimal" aria-label="Escala del icono" min={1} max={100} step="any" required value={scaleText ?? scaleValue} onChange={event => {
              if (blockedRef.current) return
              const value = event.target.valueAsNumber
              if (Number.isFinite(value) && value >= 1 && value <= 100) setScale(.25 + (value - 1) * 3.75 / 99)
              setScaleText(event.target.value)
            }} onBlur={event => {
              if (scaleText !== null && event.target.value !== '') setScale(.25 + (event.target.valueAsNumber - 1) * 3.75 / 99)
              setScaleText(null)
            }} />
            <Button aria-label="Aumentar escala" title="Aumentar escala" disabled={blocked || scaleValue >= 100} onClick={() => setScale(.25 + scaleValue * 3.75 / 99)}><AArrowUp aria-hidden="true" /></Button>
          </div>
        </div>
        <div className="element-adjustment-row">
          <span>Giro</span>
          <div className="element-transform-controls">
            <Button aria-label="Girar 10° a la izquierda" title="Girar 10° a la izquierda" onClick={() => { if (!blockedRef.current) { changed.current.add('rotation'); setRotation(value => (value + 350) % 360) } }}><RotateCcw aria-hidden="true" /></Button>
            <Button aria-label="Girar 10° a la derecha" title="Girar 10° a la derecha" onClick={() => { if (!blockedRef.current) { changed.current.add('rotation'); setRotation(value => (value + 10) % 360) } }}><RotateCw aria-hidden="true" /></Button>
          </div>
          <output aria-label="Giro actual">{rotation}°</output>
          <div className="element-transform-controls">
            <Button aria-label="Invertir horizontalmente" title="Invertir horizontalmente" aria-pressed={flipX} onClick={() => { if (!blockedRef.current) { changed.current.add('flipX'); setFlipX(value => !value) } }}><TrianglesCenterlineDashedVertical aria-hidden="true" /></Button>
            <Button aria-label="Invertir verticalmente" title="Invertir verticalmente" aria-pressed={flipY} onClick={() => { if (!blockedRef.current) { changed.current.add('flipY'); setFlipY(value => !value) } }}><TrianglesCenterlineDashedHorizontal aria-hidden="true" /></Button>
          </div>
        </div>
      </div>
      {!onSaveBatch && <Textarea ref={informationRef} rows={1} aria-label="Información" placeholder="Información" value={information} onChange={event => setInformation(event.target.value)} />}
      {error && <p id={`${nameId}-error`} role="alert">{error}</p>}
    </fieldset>
  </form>
}
