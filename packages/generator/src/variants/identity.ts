import type { NesorConfig } from '../config.js'
import type { WalkedModel } from '../dmmf/walker.js'
import { toFileBaseName } from '../util/naming.js'

/** Resolve the entity base name (default = model name, or `@nesor-entity-name` override). */
export function entityBaseOf(model: WalkedModel): string {
  const override = model.docs.tags.find((t) => t.kind === 'entity-name')
  return override?.kind === 'entity-name' ? override.name : model.name
}

function modulePathOf(model: WalkedModel): string | undefined {
  const tag = model.docs.tags.find((t) => t.kind === 'module')
  if (tag?.kind === 'module') return tag.path
  return undefined
}

/** Compute a model's output path relative to the output root, without the .ts extension. */
export function computeOutputBase(model: WalkedModel, config: NesorConfig): string {
  const file = `${toFileBaseName(model.name, config.fileNameStyle)}${config.fileNameSuffix}`
  if (config.splitMode === 'perModule') {
    const mod = modulePathOf(model)
    return mod ? `${mod.replace(/\\/g, '/')}/${file}` : file
  }
  return file
}
