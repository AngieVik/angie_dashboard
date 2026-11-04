import ts from 'typescript'

// Model possible string keys under the TypeScript contract, not runtime values.
// Keep nullish alternatives separate until ?? removes them. Anything outside
// this finite model leaves the entire stylesheet under conservative review.
export function resolveCssKeys(expression, checker) {
  const maximumValues = 32
  const combine = (left, right) => {
    if (!left || !right) return null
    const values = new Set([...left.values, ...right.values])
    if (values.size > maximumValues) return null
    return { values, nullable: left.nullable || right.nullable, basis: new Set([...left.basis, ...right.basis]) }
  }
  const visit = (node, depth = 0) => {
    if (!node || depth > 12) return null
    if (ts.isParenthesizedExpression(node)) return visit(node.expression, depth + 1)
    if (ts.isStringLiteralLike(node)) return { values: new Set([node.text]), nullable: false, basis: new Set(['literal']) }
    if (node.kind === ts.SyntaxKind.NullKeyword) return { values: new Set(), nullable: true, basis: new Set(['null']) }
    if (ts.isConditionalExpression(node)) {
      const result = combine(visit(node.whenTrue, depth + 1), visit(node.whenFalse, depth + 1))
      if (result) result.basis.add('ternario: ambas alternativas')
      return result
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
      const left = visit(node.left, depth + 1)
      if (!left) return null
      if (!left.nullable) return left
      const result = combine({ ...left, nullable: false }, visit(node.right, depth + 1))
      if (result) result.basis.add('coalescencia nullish')
      return result
    }
    // Do not treat casts, calls, arbitrary operators or interpolation as proof
    // of bounded values. Identifiers/properties may have a finite literal type.
    if (!ts.isIdentifier(node) && !ts.isPropertyAccessExpression(node)) return null
    const type = checker.getTypeAtLocation(node)
    const alternatives = type.isUnion() ? type.types : [type]
    if (alternatives.length > maximumValues) return null
    const values = new Set(), basis = new Set(['tipo literal de TypeScript'])
    let nullable = false
    for (const alternative of alternatives) {
      if (alternative.flags & ts.TypeFlags.StringLiteral) values.add(alternative.value)
      else if (alternative.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)) nullable = true
      else return null
    }
    return { values, nullable, basis }
  }
  const resolved = visit(expression)
  if (!resolved || resolved.nullable || !resolved.values.size) return null
  return { classes: [...resolved.values].sort(), basis: [...resolved.basis].sort() }
}
