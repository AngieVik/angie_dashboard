import { useCallback, useEffect, useState } from 'react'

export function useValidationNotice(initial: string | null = null, generation = 0) {
  const [notice, setNotice] = useState({ value: initial, generation })
  const show = useCallback((value: string | null) => setNotice({ value, generation }), [generation])
  useEffect(() => {
    if (notice.value === null || notice.generation !== generation) return
    const timer = setTimeout(() => setNotice({ value: null, generation }), 5000)
    return () => clearTimeout(timer)
  }, [notice, generation])
  return [notice.generation === generation ? notice.value : null, show] as const
}
