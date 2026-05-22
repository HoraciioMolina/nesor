# Recipes

Short, copy-paste-friendly patterns for common Nesor use cases. All examples use abstract names (`ModelA`, `ModelB`); replace with your own.

## Clean / hexagonal layering

Keep the generator output in your `infrastructure/generated` folder and import only types from your `domain` layer:

```ts
// domain/model-a.repository.ts
import type { ModelAEntity } from '@/infrastructure/generated/entities/model-a.entity.js'

export interface ModelARepository {
  findById(id: string): Promise<ModelAEntity | null>
}
```

The implementation (Prisma-backed) lives in `infrastructure/` and uses `@nesor/mapper` or hand-rolls a converter from the Prisma row.

## Soft delete

Treat soft-deleted rows by excluding the marker from the default entity and exposing it only in an `Audit` variant:

```prisma
/// @nesor-variant Audit include=id,name,deletedAt
model ModelA {
  id        String    @id
  name      String
  /// @nesor-exclude
  /// @nesor-include-in Audit
  deletedAt DateTime?
}
```

Default code paths receive an entity without `deletedAt`. Audit screens use `ModelAAuditEntity`.

## Branded IDs

```prisma
model ModelA {
  /// @nesor-brand ModelAId
  id String @id @default(uuid())
}

model ModelB {
  /// @nesor-brand ModelBId
  id        String @id @default(uuid())
  parentId  String  // not branded — relation FK
}
```

The branded `ModelAId` and `ModelBId` make `repository.findById(modelBId)` a type error.

## Two-shape model: list vs detail

```prisma
/// @nesor-variant Listing include=id,name,createdAt
model ModelA {
  id        String   @id
  name      String
  createdAt DateTime
  body      String
  /// @nesor-secret
  apiKey    String
}
```

`ModelAListingEntity` is what the table endpoint returns; `ModelAEntity` is the full detail (still without `apiKey`).

## Multi-module monorepo

```prisma
/// @nesor-module billing
model Invoice { ... }

/// @nesor-module identity
model User { ... }
```

With `splitMode = "perModule"`, Nesor writes `output/billing/invoice.entity.ts` and `output/identity/user.entity.ts`. Cross-module relations become `import type { UserEntity } from '../identity/user.entity.js'`.

## NestJS

```ts
// users.controller.ts
import { Controller, Get, Param } from '@nestjs/common'
import { UsersService } from './users.service.js'
import type { ModelAEntity } from '@/generated/entities/model-a.entity.js'

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ModelAEntity | null> {
    return this.users.findOne(id)
  }
}
```

Use the entity type at controllers, services, and repositories alike. DTOs (`@nestjs/swagger`) stay separate and explicit.

## Express

```ts
import express from 'express'
import { buildMapper } from '@nesor/mapper'
import { ModelAEntityMeta } from './generated/entities/model-a.entity.js'

const toModelA = buildMapper(ModelAEntityMeta)
const app = express()

app.get('/items/:id', async (req, res) => {
  const row = await prisma.modelA.findUnique({ where: { id: req.params.id } })
  res.json(row ? toModelA(row) : null)
})
```
