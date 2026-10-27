export type ReportGraphicSection = 'map' | 'plan' | 'board'
export interface ReportIssue {
  section: ReportGraphicSection
  kind: 'gpx' | 'background' | 'icon' | 'representation' | 'legend'
  resourceId: string
  label: string
  message: string
  omitted?: boolean
}
export type ReportResourceAction = 'retry' | 'omit'
export interface ReportRecovery<T> { apply: (issue: ReportIssue, action: ReportResourceAction) => Promise<T> }
export function reportIssueKey(issue: ReportIssue) { return `${issue.section}:${issue.kind}:${issue.resourceId}` }
type ReportResource = Pick<ReportIssue, 'kind' | 'resourceId' | 'label'>

export class ReportResourceError extends Error {
  constructor(message: string, readonly resource: ReportResource) { super(message); this.name = 'ReportResourceError' }
}

export function createReportIssue(section: ReportGraphicSection, error: unknown, resource: ReportResource = { kind: 'representation', resourceId: 'image', label: 'Imagen' }): ReportIssue {
  return { section, ...(error instanceof ReportResourceError ? error.resource : resource),
    message: error instanceof Error ? error.message : typeof error === 'string' ? error : 'No disponible.' }
}

export function formatReportIssue(issue: ReportIssue) { return `${issue.label}: ${issue.omitted ? 'Omitido en este informe.' : issue.message}` }
