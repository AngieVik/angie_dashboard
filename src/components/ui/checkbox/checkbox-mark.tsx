export function CheckboxMark({ indeterminate = false }: { indeterminate?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={indeterminate ? 'M5 12h14' : 'm5 12 4 4L19 6'} /></svg>
}
