import { Select } from '@/components/ui/select'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, FocusEvent, MouseEvent, PointerEvent } from 'react'
import type { AssetId, DocumentElement, ElementVisual, PinAnchor, PinNameColor, Position } from '../../domain/document/types'
import type { CreateElementInput, ElementBatchPatch } from './elementTypes'
import { getPinBox, ICON_CATALOG } from './iconCatalog'
import { clampAssetScale } from './elementCommands'
import { getPinAnchorFromPoint, getPinAnchorPoint, getRotatedPinBox, PIN_NAME_COLORS, pinTransform } from './pinPresentation'
import { Button } from '@/components/ui/button'
import { AArrowDown, AArrowUp, Crosshair, Eye, EyeOff, RotateCcw, RotateCw, SwatchBook, TrianglesCenterlineDashedHorizontal, TrianglesCenterlineDashedVertical } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { useAutoGrowingTextarea } from '../notebook/useAutoGrowingTextarea'

type ElementEditorProps = {
  element?: DocumentElement; isUnit?: boolean; creating?: boolean; formId: string
} & ({
  onSave: (input: CreateElementInput, keepOpen: boolean) => void; onSaveBatch?: never; batchCount?: never
} | {
  onSave?: never; onSaveBatch: (patch: ElementBatchPatch, keepOpen: boolean) => void; batchCount: number
})
type RepeatAction = 'name-down' | 'name-up' | 'scale-down' | 'scale-up' | 'rotate-left' | 'rotate-right' | 'flip-x' | 'flip-y'
const emojiCharacters = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

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
  const [emoji, setEmoji] = useState<string>(() => element?.visual.type === 'emoji' ? emojiCharacters.segment(element.visual.value)[Symbol.iterator]().next().value?.segment ?? '' : '')
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
  const repeatStep = useRef<(action: RepeatAction) => void>(() => {})
  const repeatTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const repeatPress = useRef<{ pointerId: number; x: number; y: number; target: HTMLButtonElement; repeated: boolean } | null>(null)
  const ignoredClick = useRef<HTMLButtonElement | null>(null)
  const stopRepeat = useCallback((ignoreClick = false) => {
    clearTimeout(repeatTimer.current); repeatTimer.current = undefined
    const press = repeatPress.current
    repeatPress.current = null
    if (!press) return
    if (ignoreClick) ignoredClick.current = press.target
    if (press.target.hasPointerCapture?.(press.pointerId)) press.target.releasePointerCapture(press.pointerId)
  }, [])
  useLayoutEffect(() => {
    repeatStep.current = action => {
      if (blockedRef.current) return
      switch (action) {
        case 'name-down': setNameSize(nameFontSize - 1); break
        case 'name-up': setNameSize(nameFontSize + 1); break
        case 'scale-down': setScale(.25 + (scaleValue - 2) * 3.75 / 99); break
        case 'scale-up': setScale(.25 + scaleValue * 3.75 / 99); break
        case 'rotate-left': changed.current.add('rotation'); setRotation(value => (value + 350) % 360); break
        case 'rotate-right': changed.current.add('rotation'); setRotation(value => (value + 10) % 360); break
        case 'flip-x': changed.current.add('flipX'); setFlipX(value => !value); break
        case 'flip-y': changed.current.add('flipY'); setFlipY(value => !value); break
      }
    }
  })
  useEffect(() => {
    if (blocked) stopRepeat(true)
  }, [blocked, stopRepeat])
  useEffect(() => {
    const otherPointer = (event: globalThis.PointerEvent) => {
      if (repeatPress.current && event.pointerId !== repeatPress.current.pointerId) stopRepeat(true)
    }
    const release = (event: globalThis.PointerEvent) => {
      const press = repeatPress.current
      if (press?.pointerId === event.pointerId) stopRepeat(event.type === 'pointercancel' || press.repeated)
    }
    const blur = () => stopRepeat(true)
    const visibility = () => { if (document.hidden) stopRepeat(true) }
    window.addEventListener('pointerdown', otherPointer, true)
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    window.addEventListener('blur', blur)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      stopRepeat()
      window.removeEventListener('pointerdown', otherPointer, true)
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
      window.removeEventListener('blur', blur)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [stopRepeat])
  function repeatingButton(action: RepeatAction) {
    return {
      className: 'element-repeat-button',
      onPointerDown(event: PointerEvent<HTMLButtonElement>) {
        stopRepeat(true)
        if (blockedRef.current || event.button !== 0 || event.isPrimary === false || event.currentTarget.disabled) return
        ignoredClick.current = null
        const press = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, target: event.currentTarget, repeated: false }
        repeatPress.current = press
        press.target.setPointerCapture?.(event.pointerId)
        const tick = () => {
          if (repeatPress.current !== press) return
          if (blockedRef.current || press.target.disabled || !press.target.isConnected) { stopRepeat(true); return }
          press.repeated = true
          repeatStep.current(action)
          repeatTimer.current = setTimeout(tick, 120)
        }
        repeatTimer.current = setTimeout(tick, 400)
      },
      onPointerMove(event: PointerEvent<HTMLButtonElement>) {
        const press = repeatPress.current
        if (press?.pointerId === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 4) stopRepeat(true)
      },
      onPointerUp(event: PointerEvent<HTMLButtonElement>) {
        const press = repeatPress.current
        if (press?.pointerId === event.pointerId) stopRepeat(press.repeated)
      },
      onPointerCancel() { stopRepeat(true) },
      onLostPointerCapture(event: PointerEvent<HTMLButtonElement>) {
        const press = repeatPress.current
        if (press?.pointerId === event.pointerId && press.target === event.currentTarget) stopRepeat(true)
      },
      onBlur(event: FocusEvent<HTMLButtonElement>) {
        if (repeatPress.current?.target === event.currentTarget) stopRepeat(true)
      },
      onContextMenu(event: MouseEvent<HTMLButtonElement>) { event.preventDefault() },
      onClick(event: MouseEvent<HTMLButtonElement>) {
        const ignored = event.detail !== 0 && ignoredClick.current === event.currentTarget
        ignoredClick.current = null
        if (ignored) { event.preventDefault(); return }
        repeatStep.current(action)
      },
    }
  }
  const transforms = { ...(rotation || element?.visual.rotation !== undefined ? { rotation } : {}),
    ...(flipX || element?.visual.flipX !== undefined ? { flipX } : {}), ...(flipY || element?.visual.flipY !== undefined ? { flipY } : {}) }
  const visual: ElementVisual = representation === 'asset' ? { type: 'asset', assetId, scale, ...transforms } : { type: 'emoji', value: emoji, scale, ...transforms }
  const previewVisual = { ...visual, scale: 1 }
  const box = getPinBox(previewVisual)
  const rotatedBox = getRotatedPinBox(previewVisual)
  const previewScene = useRef<HTMLDivElement>(null)
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const scene = previewScene.current
    if (!scene) return
    const measure = () => {
      const width = scene.clientWidth, height = scene.clientHeight
      if (!width || !height) return
      setPreviewSize(previous => previous.width === width && previous.height === height ? previous : { width, height })
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(scene)
    return () => observer?.disconnect()
  }, [])
  const previewScale = previewSize.width && previewSize.height ? Math.min(previewSize.width / rotatedBox.width, previewSize.height / rotatedBox.height) : 1
  const previewLeft = (previewSize.width - box.width * previewScale) / 2
  const previewTop = (previewSize.height - box.height * previewScale) / 2
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
  const nameTheme = PIN_NAME_COLORS[nameColor ?? 'dark']
  const nameOffset = element?.nameOffset
  // Keep the pin and coordinate tool inside a fixed rotation envelope.
  const diameter = Math.hypot(box.width, box.height)
  return <form id={formId} className="element-editor" aria-label={onSaveBatch ? 'Modificar selección' : creating ? 'Crear elemento' : 'Modificar elemento'} onSubmit={event => {
    event.preventDefault()
    if (blockedRef.current) return
    if (representation === 'emoji' && !emoji.trim() && (!onSaveBatch || changed.current.has('icon'))) return
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
        <span className="element-value-control" role="group" aria-label="Tamaño de letra del nombre">
          <Input type="number" inputMode="decimal" aria-label="Tamaño de letra del nombre" min={8} max={72} step="any" required value={nameSizeText ?? nameFontSize} onChange={event => {
            if (blockedRef.current) return
            const value = event.target.valueAsNumber
            if (Number.isFinite(value) && value >= 8 && value <= 72) setNameSize(value)
            setNameSizeText(event.target.value)
          }} onBlur={event => {
            if (nameSizeText !== null && event.target.value !== '') setNameSize(event.target.valueAsNumber)
            setNameSizeText(null)
          }} />
          <span className="element-icon-group">
            <Button aria-label="Reducir tamaño de letra" disabled={blocked || nameFontSize <= 8} {...repeatingButton('name-down')}><AArrowDown aria-hidden="true" /></Button>
            <Button aria-label="Aumentar tamaño de letra" disabled={blocked || nameFontSize >= 72} {...repeatingButton('name-up')}><AArrowUp aria-hidden="true" /></Button>
          </span>
        </span>
        <div className="element-name-controls">
          <div className="element-icon-group" role="group" aria-label="Aspecto del nombre">
            <Button aria-label={nameHidden ? 'Mostrar nombre' : 'Ocultar nombre'} aria-pressed={nameHidden} disabled={blocked} onClick={() => {
              if (!blockedRef.current) { changed.current.add('nameHidden'); setNameHidden(value => !value) }
            }}>{nameHidden ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</Button>
            <Button aria-label="Cambiar contraste" disabled={blocked} onClick={() => {
              if (blockedRef.current) return
              changed.current.add('nameColor')
              setDraftNameColor(current => {
                const colors = Object.keys(PIN_NAME_COLORS) as PinNameColor[]
                return colors[(colors.indexOf(current ?? element?.nameColor ?? 'dark') + 1) % colors.length]!
              })
            }}><SwatchBook aria-hidden="true" /></Button>
          </div>
          <span className="element-name-sample" role="img" aria-label={`Contraste: ${nameTheme.label}`} style={{ backgroundColor: nameTheme.backgroundColor, color: nameTheme.color }}>A</span>
        </div>
      </div>
      <div className="element-representation-row">
        <div className="element-representation-control" role="group" aria-label="Tipo de pin">
          <Button aria-pressed={representation === 'asset'} disabled={blocked} onClick={() => {
            if (!blockedRef.current && representation !== 'asset') { changed.current.add('icon'); setRepresentation('asset') }
          }}>PNG</Button>
          <Button aria-pressed={representation === 'emoji'} disabled={blocked} onClick={() => {
            if (!blockedRef.current && representation !== 'emoji') { changed.current.add('icon'); setRepresentation('emoji') }
          }}>Emoji</Button>
        </div>
        <Input className="element-emoji-control" aria-label="Emoji" disabled={blocked || representation !== 'emoji'} value={emoji} onChange={event => {
          if (!blockedRef.current && representation === 'emoji') {
            changed.current.add('icon')
            setEmoji(emojiCharacters.segment(event.target.value)[Symbol.iterator]().next().value?.segment ?? '')
          }
        }} />
      </div>
      <label className="element-pin-choice">PIN<Select aria-label="PIN" value={assetId} disabled={blocked || representation !== 'asset'}
        onValueChange={value => { if (!blockedRef.current && representation === 'asset') { changed.current.add('icon'); setAssetId(value as AssetId) } }}
        options={[...(!catalog.includes(assetId) ? [{ value: assetId, label: ICON_CATALOG[assetId].name + ' (actual)' }] : []), ...catalog.map(id => ({ value: id, label: ICON_CATALOG[id].name }))]} />
      </label>
      <div className="element-scale-control">
        <div className="element-adjustment-row">
          <span>Escala</span>
          <div className="element-value-control" role="group" aria-label="Escala del icono">
            <Input type="number" inputMode="decimal" aria-label="Escala del icono" min={1} max={100} step="any" required value={scaleText ?? scaleValue} onChange={event => {
              if (blockedRef.current) return
              const value = event.target.valueAsNumber
              if (Number.isFinite(value) && value >= 1 && value <= 100) setScale(.25 + (value - 1) * 3.75 / 99)
              setScaleText(event.target.value)
            }} onBlur={event => {
              if (scaleText !== null && event.target.value !== '') setScale(.25 + (event.target.valueAsNumber - 1) * 3.75 / 99)
              setScaleText(null)
            }} />
            <span className="element-icon-group">
              <Button aria-label="Reducir escala" disabled={blocked || scaleValue <= 1} {...repeatingButton('scale-down')}><AArrowDown aria-hidden="true" /></Button>
              <Button aria-label="Aumentar escala" disabled={blocked || scaleValue >= 100} {...repeatingButton('scale-up')}><AArrowUp aria-hidden="true" /></Button>
            </span>
          </div>
        </div>
        <div className="element-adjustment-row">
          <span>Giro</span>
          <div className="element-transform-controls element-icon-group">
            <Button aria-label="Girar 10° a la izquierda" {...repeatingButton('rotate-left')}><RotateCcw aria-hidden="true" /></Button>
            <Button aria-label="Girar 10° a la derecha" {...repeatingButton('rotate-right')}><RotateCw aria-hidden="true" /></Button>
          </div>
          <div className="element-transform-controls element-icon-group">
            <Button aria-label="Invertir horizontalmente" aria-pressed={flipX} {...repeatingButton('flip-x')}><TrianglesCenterlineDashedVertical aria-hidden="true" /></Button>
            <Button aria-label="Invertir verticalmente" aria-pressed={flipY} {...repeatingButton('flip-y')}><TrianglesCenterlineDashedHorizontal aria-hidden="true" /></Button>
          </div>
        </div>
      </div>
      {!onSaveBatch && <Textarea ref={informationRef} rows={1} aria-label="Información" placeholder="Información" value={information} onChange={event => setInformation(event.target.value)} />}
      <div className="element-preview-frame" style={{ '--element-preview-diameter': `${diameter}px` } as CSSProperties}>
        <div className="element-preview" role="img" aria-label="Previsualización del elemento">
          <div ref={previewScene} className="element-preview-scene">
            <div ref={previewPin} className="element-preview-pin" style={{ left: previewLeft, top: previewTop, width: box.width * previewScale, height: box.height * previewScale }}>
              {visual.type === 'asset' ? <img src={ICON_CATALOG[visual.assetId].path} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', transform: pinTransform(visual) }} /> :
                <span className="board-pin-emoji" style={{ display: 'block', fontSize: 48 * previewScale, lineHeight: `${64 * previewScale}px`, transform: pinTransform(visual) }}>{visual.value}</span>}
            </div>
            <Crosshair className="element-anchor-mark" aria-hidden="true" style={{ left: previewLeft + anchorPoint.x * previewScale, top: previewTop + anchorPoint.y * previewScale }} />
          </div>
        </div>
        <button type="button" className="element-anchor-picker" aria-label="Punto de coordenadas"
          aria-description="Arrastra o usa las flechas. Mayús para ajuste fino." disabled={blocked}
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
    </fieldset>
  </form>
}
