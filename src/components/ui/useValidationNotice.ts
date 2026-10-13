import { useCallback, useEffect, useState } from 'react'

export function useValidationNotice(initial: string | null = null, generation = 0, durationMs = 5000) {
  const [notice, setNotice] = useState({ value: initial, generation })
  const show = useCallback((value: string | null) => setNotice({ value, generation }), [generation])
  useEffect(() => {
    if (notice.value === null || notice.generation !== generation) return
    const timer = setTimeout(() => setNotice({ value: null, generation }), durationMs)
    return () => clearTimeout(timer)
  }, [notice, generation, durationMs])
  return [notice.generation === generation ? notice.value : null, show] as const
}
