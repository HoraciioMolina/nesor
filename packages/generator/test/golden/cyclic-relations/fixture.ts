import { DEFAULT_CONFIG, type NesorConfig } from '../../../src/config.js'
import type { WalkedSchema } from '../../../src/dmmf/walker.js'
import { field, model, schema } from '../../helpers/walked.js'

export const config: NesorConfig = { ...DEFAULT_CONFIG, includeRelations: 'required' }

// Bidirectional one-to-one references. Each side imports the other via
// `import type` so no runtime cycle is created.
export const walkedSchema: WalkedSchema = schema([
  model('ModelA', [
    field('ModelA', 'id', 'String', 'scalar', { isId: true }),
    field('ModelA', 'b', 'ModelB', 'object', { isRequired: false }),
  ]),
  model('ModelB', [
    field('ModelB', 'id', 'String', 'scalar', { isId: true }),
    field('ModelB', 'a', 'ModelA', 'object', { isRequired: false }),
  ]),
])
