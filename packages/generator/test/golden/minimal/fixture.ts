import { DEFAULT_CONFIG, type NesorConfig } from '../../../src/config.js'
import type { WalkedSchema } from '../../../src/dmmf/walker.js'
import { field, model, schema } from '../../helpers/walked.js'

export const config: NesorConfig = { ...DEFAULT_CONFIG }

export const walkedSchema: WalkedSchema = schema([
  model('ModelA', [
    field('ModelA', 'id', 'String', 'scalar', { isId: true }),
    field('ModelA', 'name', 'String', 'scalar'),
    field('ModelA', 'count', 'Int', 'scalar'),
  ]),
])
