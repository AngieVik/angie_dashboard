const MAX_PIN_TEXT_LENGTH = 10
const characters = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

function measurePinText(value: string) {
  let length = 0
  for (const { index } of characters.segment(value)) {
    if (length === MAX_PIN_TEXT_LENGTH) return { length, end: index }
    length++
  }
  return { length, end: value.length }
}

export function limitPinText(value: string) {
  return value.slice(0, measurePinText(value).end)
}

export function pinTextLength(value: string) {
  return measurePinText(value).length
}

export function pinTextFontSize(value: string) {
  return Math.min(48, 64 / Math.max(1, pinTextLength(value)))
}
