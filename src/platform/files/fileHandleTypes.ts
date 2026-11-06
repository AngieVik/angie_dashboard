export type DocumentFile = Pick<File, 'size' | 'text'> & { readonly name?: string }

export interface SaveFileHandle {
  readonly name?: string
  getFile?(): Promise<DocumentFile>
  isSameEntry?(other: SaveFileHandle): Promise<boolean>
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>
  createWritable(options?: { mode: 'exclusive' }): Promise<{
    write(text: string): Promise<void>
    close(): Promise<void>
    abort(): Promise<void>
  }>
}
