import { DEFAULT_CONFIG, type NesorConfig } from '../../../src/config.js'
import type { WalkedSchema } from '../../../src/dmmf/walker.js'
import { field, model, schema } from '../../helpers/walked.js'

export const config: NesorConfig = { ...DEFAULT_CONFIG }

// Demonstrates Compact (include=), Slim (exclude=), and the @nesor-exclude-from
// field-level override that further trims a specific variant.
export const walkedSchema: WalkedSchema = schema([
  model(
    'ModelA',
    [
      field('ModelA', 'id', 'String', 'scalar', { isId: true }),
      field('ModelA', 'name', 'String', 'scalar'),
      field('ModelA', 'description', 'String', 'scalar', { isRequired: false }),
      field('ModelA', 'count', 'Int', 'scalar'),
      field('ModelA', 'volatile', 'String', 'scalar', {
        docs: '@nesor-exclude-from Slim',
      }),
    ],
    '@nesor-variant Compact include=id,name\n@nesor-variant Slim exclude=description',
  ),
])
