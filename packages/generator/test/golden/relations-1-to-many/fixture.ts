import { DEFAULT_CONFIG, type NesorConfig } from '../../../src/config.js'
import type { WalkedSchema } from '../../../src/dmmf/walker.js'
import { field, model, schema } from '../../helpers/walked.js'

export const config: NesorConfig = { ...DEFAULT_CONFIG, includeRelations: 'required' }

export const walkedSchema: WalkedSchema = schema([
  model('ModelA', [
    field('ModelA', 'id', 'String', 'scalar', { isId: true }),
    field('ModelA', 'name', 'String', 'scalar'),
    field('ModelA', 'children', 'ModelB', 'object', { isList: true }),
  ]),
  model('ModelB', [
    field('ModelB', 'id', 'String', 'scalar', { isId: true }),
    field('ModelB', 'parentId', 'String', 'scalar'),
    field('ModelB', 'parent', 'ModelA', 'object'),
    field('ModelB', 'label', 'String', 'scalar'),
  ]),
])
