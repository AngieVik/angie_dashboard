import { useCallback, useEffect, useId, useState } from 'react'
import { toast } from '@/components/ui/sonner'

export function useValidationNotice(initial: string | null = null, generation = 0, durationMs: number | null = 5000) {
  const [notice, setNotice] = useState({ value: initial, generation })
  const id = useId()
  const show = useCallback((value: string | null) => {
    setNotice({ value, generation })
    if (value) toast.error(value, { id, duration: durationMs ?? undefined })
    else toast.dismiss(id)
  }, [generation, id, durationMs])
  useEffect(() => () => { toast.dismiss(id) }, [id, generation])
  useEffect(() => {
    if (notice.value === null || notice.generation !== generation || durationMs === null) return
    const timer = setTimeout(() => setNotice({ value: null, generation }), durationMs)
    return () => clearTimeout(timer)
  }, [notice, generation, durationMs])
  return [notice.generation === generation ? notice.value : null, show] as const
}
