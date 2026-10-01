import { describe, expect, it } from 'vitest'
import { evaluateExpression } from './expression'

describe('Evaluador de calculadora', () => {
  it.each([
    ['2 + 3', 5], ['8 - 12', -4], ['7 × 6', 42], ['12 ÷ 4', 3],
    ['2 + 3 * 4', 14], ['20 / 2 / 5', 2], ['10 - 3 - 2', 5],
    ['(2 + 3) × (7 - 4)', 15], ['2 * (3 + (4 / 2))', 10],
    ['1,25 + 2.5', 3.75], [',5 + .25', 0.75], ['0,1 + 0,2', 0.3],
    ['-3 × 2', -6], ['2 * -3', -6], ['-(2 + 3)', -5], ['+3', 3],
    ['10 %', 0.1], ['200 + 10 %', 220], ['200 - 10 %', 180],
    ['200 × 10 %', 20], ['200 ÷ 10 %', 2000], ['80 + 12,5 %', 90],
    ['(10 %)', 0.1], ['(200 + 10 %)', 220], ['(200 - 10 %)', 180],
    ['(200 × 10 %)', 20], ['(200 ÷ 10 %)', 2000], ['(80 + 12,5 %)', 90],
    ['200 + (10 %)', 220], ['200 + (5 + 5) %', 220],
    ['200 + 10 % + 10 %', 242], ['200 + 10 % × 2', 200.2],
    ['100 - -10 %', 110], ['200 × (100 + 10 %) / 100', 220],
    ['  2 +\t3\n', 5],
  ])('%s = %s', (input, expected) => {
    const result = evaluateExpression(input)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBeCloseTo(expected, 12)
  })

  it.each(['1 / 0', '200 ÷ 0 %', '(200 ÷ 0 %)', '1 / (2 - 2)'])('rechaza división por cero: %s', input => {
    const result = evaluateExpression(input)
    expect(result).toEqual({ ok: false, error: 'División por cero' })
    expect(result).not.toHaveProperty('value')
  })

  it.each(['', ' ', '1 +', '()', '(1 + 2', '1 + 2)', '1..2', '1,2,3', '2 3', '2(3)',
    '%10', '2 ** 3', 'Math.sqrt(4)', 'globalThis', '1;alert(1)', '1e3', 'Infinity', 'NaN'])('rechaza entrada inválida sin ejecutarla: %s', input => {
    const result = evaluateExpression(input)
    expect(result.ok).toBe(false)
    expect(result).not.toHaveProperty('value')
    if (!result.ok) expect(result.error).not.toBe('')
  })

  it('rechaza un resultado no finito y limita entradas excesivas sin lanzar excepciones', () => {
    expect(evaluateExpression(`${'9'.repeat(200)} * ${'9'.repeat(200)}`)).toEqual({ ok: false, error: 'Resultado fuera de rango' })
    expect(evaluateExpression('('.repeat(2000) + '1' + ')'.repeat(2000)).ok).toBe(false)
  })
})
