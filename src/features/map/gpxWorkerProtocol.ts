import type { PackedGpx } from './gpxTransfer'
import type { GpxAllowance } from './gpxBudget'
import type { ValidationIssue } from '../../domain/document/types'

export interface GpxOperation { operationId: string; documentGeneration: number }
export interface GpxWorkerRequest extends GpxOperation { file: File; expectedFingerprint?: string; allowance?: GpxAllowance }
export type GpxWorkerResponse = GpxOperation & (
  | { ok: true; fingerprint: string; packed: PackedGpx; cached?: false }
  | { ok: true; fingerprint: string; cached: true }
  | { ok: false; message: string; issue?: ValidationIssue }
)
