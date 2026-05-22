import { DEFAULT_CONFIG, type NesorConfig } from '../../../src/config.js'
import type { WalkedSchema } from '../../../src/dmmf/walker.js'
import { field, model, schema } from '../../helpers/walked.js'

export const config: NesorConfig = { ...DEFAULT_CONFIG }

export const walkedSchema: WalkedSchema = schema([
  model('ModelA', [
    field('ModelA', 'id', 'String', 'scalar', { isId: true }),
    field('ModelA', 'requiredText', 'String', 'scalar'),
    field('ModelA', 'optionalText', 'String', 'scalar', { isRequired: false }),
    field('ModelA', 'requiredList', 'String', 'scalar', { isList: true }),
    field('ModelA', 'optionalInt', 'Int', 'scalar', { isRequired: false }),
  ]),
])
