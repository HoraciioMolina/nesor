import { DEFAULT_CONFIG, type NesorConfig } from '../../../src/config.js'
import type { WalkedSchema } from '../../../src/dmmf/walker.js'
import { field, model, schema } from '../../helpers/walked.js'

export const config: NesorConfig = { ...DEFAULT_CONFIG }

// Soft delete pattern: deletedAt is excluded from the default entity, but the consumer
// can declare an Audit variant via @nesor-include-in that sees it again.
export const walkedSchema: WalkedSchema = schema([
  model(
    'ModelA',
    [
      field('ModelA', 'id', 'String', 'scalar', { isId: true }),
      field('ModelA', 'name', 'String', 'scalar'),
      field('ModelA', 'deletedAt', 'DateTime', 'scalar', {
        isRequired: false,
        docs: '@nesor-exclude\n@nesor-include-in Audit',
      }),
    ],
    '@nesor-variant Audit include=id,name,deletedAt',
  ),
])
