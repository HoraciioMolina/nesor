import { DEFAULT_CONFIG, type NesorConfig } from '../../../src/config.js'
import type { WalkedSchema } from '../../../src/dmmf/walker.js'
import { field, model, schema } from '../../helpers/walked.js'

export const config: NesorConfig = {
  ...DEFAULT_CONFIG,
  splitMode: 'perModule',
  includeRelations: 'required',
}

// Two models in two modules, with a cross-module relation. Import paths
// should resolve through `../<otherModule>/...`.
export const walkedSchema: WalkedSchema = schema([
  model(
    'ModelA',
    [
      field('ModelA', 'id', 'String', 'scalar', { isId: true }),
      field('ModelA', 'name', 'String', 'scalar'),
      field('ModelA', 'tag', 'ModelB', 'object'),
    ],
    '@nesor-module identity',
  ),
  model(
    'ModelB',
    [
      field('ModelB', 'id', 'String', 'scalar', { isId: true }),
      field('ModelB', 'label', 'String', 'scalar'),
    ],
    '@nesor-module billing',
  ),
])
