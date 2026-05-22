import generatorHelper from '@prisma/generator-helper'
import type { GeneratorOptions } from '@prisma/generator-helper'
import { runGenerator } from './run.js'

export type { NesorConfig } from './config.js'
export type { EntityMeta, FieldInfo, VariantInfo } from './types.js'

const { generatorHandler } = generatorHelper

generatorHandler({
  onManifest() {
    // Nesor consumes the DMMF that Prisma already produces; it does NOT depend
    // on prisma-client-js's emitted output. Listing it under requiresGenerators
    // would break consumers of the new `prisma-client` (Prisma 6 preview).
    return {
      defaultOutput: './generated/entities',
      prettyName: 'Nesor',
    }
  },
  async onGenerate(options: GeneratorOptions) {
    await runGenerator(options)
  },
})
