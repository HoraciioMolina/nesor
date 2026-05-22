import { DEFAULT_CONFIG, type NesorConfig } from '../../../src/config.js'
import type { WalkedSchema } from '../../../src/dmmf/walker.js'
import { field, model, schema } from '../../helpers/walked.js'

// Inline strategy (default): enum values become a TS union right inside the interface.
export const config: NesorConfig = { ...DEFAULT_CONFIG, enumStrategy: 'inline' }

export const walkedSchema: WalkedSchema = schema(
  [
    model('ModelA', [
      field('ModelA', 'id', 'String', 'scalar', { isId: true }),
      field('ModelA', 'status', 'StatusA', 'enum'),
      field('ModelA', 'priority', 'PriorityA', 'enum', { isRequired: false }),
    ]),
  ],
  [
    { name: 'StatusA', values: ['Active', 'Archived', 'Pending'], documentation: undefined },
    { name: 'PriorityA', values: ['Low', 'Medium', 'High'], documentation: undefined },
  ],
)
