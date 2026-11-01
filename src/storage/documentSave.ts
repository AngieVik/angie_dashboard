import type { AngieDocument } from '../domain/document/types'
import { serializeWorkingDocument as serializeDocument } from '../domain/document/serializeWorkingDocument'

export interface PreparedDocumentSave { readonly document: AngieDocument; readonly text: string }

// The store owns immutable revisions. Keep their references while coalescing,
// then materialize only the selected revision, shared by both save channels.
export class DocumentSave {
  readonly documentId: string
  private prepared?: PreparedDocumentSave
  constructor(private readonly source: AngieDocument, private text?: string) {
    this.documentId = source.document.id
  }
  // A worker already detached and validated this immutable revision.
  static fromPrepared(prepared: PreparedDocumentSave): DocumentSave {
    const save = new DocumentSave(prepared.document, prepared.text)
    save.prepared = prepared
    return save
  }
  prepare(): PreparedDocumentSave {
    if (!this.prepared) {
      this.text ??= serializeDocument(this.source)
      this.prepared = { document: JSON.parse(this.text) as AngieDocument, text: this.text }
    }
    return this.prepared
  }
}
