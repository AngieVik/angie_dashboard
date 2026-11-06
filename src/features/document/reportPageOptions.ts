export interface ReportPageOptions { orientation: 'portrait' | 'landscape' }
export const DEFAULT_REPORT_PAGE: ReportPageOptions = { orientation: 'portrait' }
export const REPORT_PAGE_MARGIN_MM = 12

export function reportPageDimensions(options: ReportPageOptions) {
  return options.orientation === 'landscape' ? { width: 297, height: 210 } : { width: 210, height: 297 }
}
