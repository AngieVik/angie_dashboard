export const REPORT_SECTIONS = {
  metadata: { title: 'Fechas', fields: { createdAt: 'Documento creado', updatedAt: 'Última edición', generatedAt: 'Informe generado' } },
  elements: { title: 'Elementos', fields: { name: 'Nombre', information: 'Información' } },
  dotations: { title: 'Dotaciones', fields: { name: 'Nombre', information: 'Información', tags: 'Etiquetas' } },
  information: { title: 'Información', fields: { name: 'Dotación', information: 'Información', status: 'Estado actual', notes: 'Notas', tags: 'Etiquetas' } },
  operations: { title: 'Operativo', fields: { name: 'Dotación', status: 'Estado actual', notes: 'Notas', tags: 'Etiquetas' } },
  timeline: { title: 'Registro', fields: { occurredAt: 'Fecha y hora', type: 'Tipo', text: 'Contenido', condition: 'Condición', revisions: 'Correcciones y eliminaciones' } },
  notebook: { title: 'Cuaderno', fields: { title: 'Título', text: 'Notas y listas' } },
  timers: { title: 'Temporizadores', fields: { name: 'Nombre', status: 'Estado', value: 'Valor' } },
} as const
export type ReportSection = keyof typeof REPORT_SECTIONS
export type ReportSelection = Partial<Record<ReportSection, string[]>>
export function defaultReportSelection(): ReportSelection {
  return Object.fromEntries(Object.entries(REPORT_SECTIONS).map(([id, section]) => [id, id === 'timers' ? [] : Object.keys(section.fields)]))
}
