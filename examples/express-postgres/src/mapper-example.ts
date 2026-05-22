// Three usage levels for mapping a Prisma row to a Nesor entity.
// Level 0: hand-roll the function.
// Level 1: lean on @nesor/mapper for trivial cases.
// Level 2: same, plus per-field transforms.

import { buildMapper } from '@nesor/mapper'
import {
  type IdA,
  type ModelAEntity,
  ModelAEntityMeta,
} from './generated/entities/model-a.entity.js'

/** A row shaped like what Prisma would return for ModelA. */
interface ModelARow {
  id: string
  name: string
  count: number
  isActive: boolean
  createdAt: Date
  status: 'Active' | 'Archived'
  tags: string[]
  optional: string | null
  apiKey: string
  internalNote: string
}

// Level 0 — hand-roll.
export function toModelAEntityHandRolled(row: ModelARow): ModelAEntity {
  return {
    id: row.id as IdA,
    name: row.name,
    count: row.count,
    isActive: row.isActive,
    createdAtIso: row.createdAt,
    status: row.status,
    tags: row.tags,
    optional: row.optional,
  }
}

// Level 1 — buildMapper from EntityMeta. Renames and exclusions are honoured;
// `apiKey` and `internalNote` are never read from the row.
export const toModelAEntity = buildMapper<ModelARow, ModelAEntity>(ModelAEntityMeta)

// Level 2 — buildMapper with per-field overrides.
export const toModelAEntityWithTransforms = buildMapper<ModelARow, ModelAEntity>(ModelAEntityMeta, {
  transform: {
    // Round trip via ISO string to drop sub-second precision, for example.
    createdAtIso: (row) => new Date(row.createdAt.toISOString().slice(0, 19)),
  },
})
