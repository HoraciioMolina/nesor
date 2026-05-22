import { DEFAULT_CONFIG, type NesorConfig } from '../../../src/config.js'
import type { WalkedSchema } from '../../../src/dmmf/walker.js'
import { field, model, schema } from '../../helpers/walked.js'

export const config: NesorConfig = { ...DEFAULT_CONFIG, includeRelations: 'required' }

// Implicit M2M: each side is a list on the other side.
export const walkedSchema: WalkedSchema = schema([
  model('ModelA', [
    field('ModelA', 'id', 'String', 'scalar', { isId: true }),
    field('ModelA', 'name', 'String', 'scalar'),
    field('ModelA', 'tags', 'ModelB', 'object', { isList: true }),
  ]),
  model('ModelB', [
    field('ModelB', 'id', 'String', 'scalar', { isId: true }),
    field('ModelB', 'label', 'String', 'scalar'),
    field('ModelB', 'subjects', 'ModelA', 'object', { isList: true }),
  ]),
])
