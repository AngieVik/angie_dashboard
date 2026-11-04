export type DocumentFile = Pick<File, 'size' | 'text'>

export interface SaveFileHandle {
  getFile?(): Promise<DocumentFile>
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>
  createWritable(): Promise<{
    write(text: string): Promise<void>
    close(): Promise<void>
    abort(): Promise<void>
  }>
}
