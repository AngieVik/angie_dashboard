export type CalculationResult = { ok: true; value: number } | { ok: false; error: string }

interface Operand { value: number; percentage: boolean }
type Token = { type: 'number'; value: number } | { type: 'operator'; value: string }

function finite(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Resultado fuera de rango')
  return value
}

function tokenize(expression: string): Token[] {
  if (expression.length > 4096) throw new Error('Operación demasiado larga')
  const tokens: Token[] = []
  let position = 0
  while (position < expression.length) {
    const character = expression.charAt(position)
    if (/\s/.test(character)) { position++; continue }
    const number = /^(?:\d+(?:[.,]\d*)?|[.,]\d+)/.exec(expression.slice(position))
    if (number) {
      tokens.push({ type: 'number', value: finite(Number(number[0].replace(',', '.'))) })
      position += number[0].length
    } else if ('+-−*×/÷()%'.includes(character)) {
      tokens.push({ type: 'operator', value: character === '×' ? '*' : character === '÷' ? '/' : character === '−' ? '-' : character })
      position++
    } else throw new Error('Carácter no válido en la operación')
  }
  return tokens
}

// Recursive descent: sum → product → unary → primary/postfix.
// The percentage marker survives parentheses and signs. A product consumes it
// as a ratio; a direct right operand of + or - uses the left value as its base.
export function evaluateExpression(expression: string): CalculationResult {
  try {
    const tokens = tokenize(expression)
    let position = 0
    function take(operator: string): boolean {
      const token = tokens[position]
      if (token?.type !== 'operator' || token.value !== operator) return false
      position++
      return true
    }
    function primary(depth: number): Operand {
      let operand: Operand
      const token = tokens[position]
      if (take('(')) {
        operand = sum(depth + 1)
        if (!take(')')) throw new Error('Falta cerrar un paréntesis')
      } else if (token?.type === 'number') {
        position++
        operand = { value: token.value, percentage: false }
      } else throw new Error('Operación incompleta o no válida')
      while (take('%')) operand = { value: operand.value / 100, percentage: true }
      return operand
    }
    function unary(depth: number): Operand {
      if (depth > 128) throw new Error('Operación demasiado anidada')
      if (take('+')) return unary(depth + 1)
      if (take('-')) { const operand = unary(depth + 1); return { ...operand, value: -operand.value } }
      return primary(depth)
    }
    function product(depth: number): Operand {
      let left = unary(depth)
      while (true) {
        const multiply = take('*')
        if (!multiply && !take('/')) return left
        const right = unary(depth)
        if (!multiply && right.value === 0) throw new Error('División por cero')
        left = { value: finite(multiply ? left.value * right.value : left.value / right.value), percentage: false }
      }
    }
    function sum(depth: number): Operand {
      let left = product(depth)
      while (true) {
        const add = take('+')
        if (!add && !take('-')) return left
        const right = product(depth)
        const amount = right.percentage ? finite(left.value * right.value) : right.value
        left = { value: finite(add ? left.value + amount : left.value - amount), percentage: false }
      }
    }
    const result = sum(0)
    if (position !== tokens.length) throw new Error('Operación incompleta o no válida')
    return { ok: true, value: result.value === 0 ? 0 : result.value }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Operación no válida' }
  }
}
