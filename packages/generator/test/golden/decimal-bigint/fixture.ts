import { DEFAULT_CONFIG, type NesorConfig } from '../../../src/config.js'
import type { WalkedSchema } from '../../../src/dmmf/walker.js'
import { field, model, schema } from '../../helpers/walked.js'

// Money + IDs: keeps decimalType="string" (default) and bigIntType="bigint".
// The Decimal advisory JSDoc should appear on the money field.
export const config: NesorConfig = { ...DEFAULT_CONFIG }

export const walkedSchema: WalkedSchema = schema([
  model('ModelA', [
    field('ModelA', 'id', 'BigInt', 'scalar', { isId: true }),
    field('ModelA', 'amount', 'Decimal', 'scalar'),
    field('ModelA', 'discount', 'Decimal', 'scalar', { isRequired: false }),
    field('ModelA', 'createdAt', 'DateTime', 'scalar'),
  ]),
])
