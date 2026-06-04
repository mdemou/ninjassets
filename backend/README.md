# ninjasset — Backend

Hapi.js backend with a layered hexagonal architecture.

## Folder Structure

```
src/
  main.ts                                       # Entry point
  config/
    config.ts                                   # Centralized configuration
  domain/
    _interfaces/
      asset.interface.ts                        # Domain data types
      site.interface.ts
      stats.interface.ts
      transaction.interface.ts
      passwordReset.interface.ts
      registration.interface.ts
      session.interface.ts
      user.interface.ts
      userManagement.interface.ts
    _repositories/
      asset.repository.ts                       # Repository contracts (interfaces)
      site.repository.ts
      stats.repository.ts
      transaction.repository.ts
      emailVerificationToken.repository.ts
      passwordResetToken.repository.ts
      session.repository.ts
      user.repository.ts
    assets/
      assets.domain.ts                          # Asset CRUD + lifecycle/assignment + site link + audit logging
      assets.errors.ts
    sites/
      sites.domain.ts                           # Site CRUD + delete-with-assets factory
      sites.errors.ts
    stats/
      stats.domain.ts                           # Dashboard analytics aggregates
    transactions/
      transactions.domain.ts                    # Asset history listing (role-scoped)
    session/
      session.domain.ts                         # Login / logout logic factory
      session.errors.ts
      admin/
        session.domain.ts                       # Admin JWT validation factory
      user/
        session.domain.ts                       # User JWT validation factory
    users/
      users.domain.ts                           # User profile / change password / delete account
      users.errors.ts
      management/
        management.domain.ts                    # Admin user CRUD factory
        management.errors.ts
      passwordReset/
        passwordReset.domain.ts
        passwordReset.errors.ts
      registration/
        registration.domain.ts
        registration.errors.ts
  infrastructure/
    plugins/
      plugins.ts                                # Hapi plugin registrations
    proceses/
      init.ts                                   # Server initialization orchestrator
      lifecycle.ts                              # Graceful shutdown handlers
      scheduler.ts                              # Redis-backed periodic maintenance
      queueConsumer.ts                          # Notification queue consumer
      importExportWorker.ts                     # Import/export async job worker
    repositories/
      assetDb/
        assetDb.repository.ts                   # Postgres implementation (search, pagination, joins, effective coords)
        assetDb.adapter.ts                      # DB-to-Domain adapters
        assetDb.interface.ts
        assetDb.errors.ts
      siteDb/
        siteDb.repository.ts                    # Postgres implementation (asset-count subquery, delete-linked)
        siteDb.adapter.ts
        siteDb.interface.ts
        siteDb.errors.ts
      statsDb/
        statsDb.repository.ts                   # Dashboard aggregate queries (counts, group-bys)
        statsDb.errors.ts
      transactionDb/
        transactionDb.repository.ts             # Audit-log insert (bulk) + search/pagination
        transactionDb.adapter.ts
        transactionDb.interface.ts
        transactionDb.errors.ts
      emailVerificationTokenDb/
        emailVerificationTokenDb.repository.ts  # Postgres implementation
        emailVerificationTokenDb.errors.ts
      passwordResetTokenDb/
        passwordResetTokenDb.repository.ts
        passwordResetTokenDb.errors.ts
      sessionDb/
        sessionDb.repository.ts
        sessionDb.errors.ts
      userDb/
        userDb.repository.ts
        userDb.adapter.ts                       # DB-to-Domain / Domain-to-DB adapters
        userDb.interface.ts
        userDb.errors.ts
    roles/
      capabilities.ts                           # CapabilityEnum + permission helpers
      roles.service.ts                          # requireCapability / effectivePermissions
    routes/
      routes.ts                                 # Route aggregator
      default.route.ts                          # Catch-all 404
      doc/
        docFactory.ts                           # Swagger response factory
      assets/
        assets.route.ts                         # Asset routes (reads: admin+user, writes: admin)
        assets.controller.ts
        assets.doc.ts
        assets.responses.ts
      sites/
        sites.route.ts                          # Site routes (admin only)
        sites.controller.ts
        sites.doc.ts
        sites.responses.ts
      stats/
        stats.route.ts                          # Dashboard analytics (admin only)
        stats.controller.ts
        stats.doc.ts
        stats.responses.ts
      transactions/
        transactions.route.ts                   # Full asset history (admin only)
        transactions.controller.ts
        transactions.doc.ts
        transactions.responses.ts
      me/
        me.route.ts                             # Personal reads (/api/me/assets, /api/me/transactions) scoped to caller
        me.controller.ts
        me.doc.ts
        me.responses.ts
      health/
        health.route.ts
        health.controller.ts
        health.doc.ts
      session/
        session.route.ts
        session.controller.ts
        session.doc.ts
        session.responses.ts
        validationFailAction.ts
      admin/
        users/
          users.route.ts
          users.controller.ts
          users.doc.ts
          users.responses.ts
      users/
        users.route.ts
        users.controller.ts
        users.doc.ts
        users.responses.ts
        passwordReset/
          passwordReset.route.ts
          passwordReset.controller.ts
          passwordReset.doc.ts
          passwordReset.responses.ts
        registration/
          registration.route.ts
          registration.controller.ts
          registration.doc.ts
          registration.responses.ts
    strategies/
      strategies.ts                             # Auth strategy registrations
      strategies.errors.ts                      # Auth error classes
      schemas/
        JWTAdmin.schema.ts                      # JWT payload type guards
        JWTUser.schema.ts
        JWTAdminAndUser.schema.ts               # Composite auth scheme
  services/
    server.service.ts                           # Hapi server factory
    sql.service.ts                              # Knex singleton
    jwt.service.ts                              # JWT sign / verify
    captcha.service.ts                          # reCAPTCHA validation
    crypto.service.ts                           # bcrypt hashing, timing-safe compare, password generation
    logger.service.ts                           # Pino logger
    delay.service.ts                            # Async delay utility
    redis.service.ts                            # ioredis client (optional, if includeRedis)
    email/
      email.service.ts
      email.interface.ts
      templates/
        password-reset.ts
        verification.ts
    responses/
      responses.service.ts                      # Standardized response builder
      responses.interfaces.ts
```

## Layer Responsibilities

| Layer              | Purpose                                                                                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **config**         | Environment-driven configuration. Leaf module — imports nothing from `src/`.                                                                                                                       |
| **domain**         | Pure business logic. Defines interfaces, repository contracts, error constants, and domain factory functions. Never imports from `infrastructure`.                                                 |
| **services**       | Reusable utilities (hashing, JWT, logging, DB connection). May import from `config`. Never imports from `infrastructure` or `domain`.                                                              |
| **infrastructure** | Everything that touches the outside world: routes, controllers, plugins, strategies, repository implementations. This is where domain factories get instantiated with their concrete dependencies. |

## Background jobs

At boot (`proceses/init.ts`):

- **Scheduler** — `scheduler.ts` runs periodic maintenance (token cleanup, API log retention, notification reaper, webhook data-quality scan, import/export safety sweep, artifact purge). Uses Redis for `lastRunAt` and optional SETNX locks; degrades to in-memory timing when Redis is down. See [spec-health-operations.md](../docs/spec-health-operations.md) §4.
- **Notification consumer** — `queueConsumer.ts` drains the Redis notification list (webhooks + mandatory emails) when `NOTIFICATIONS_ENABLED`.
- **Import/export worker** — `importExportWorker.ts` is event-driven (BLPOP on `REDIS_IMPORT_EXPORT_QUEUE`); the DB drain is authoritative. A scheduler sweep (`IMPORT_SAFETY_SWEEP_MS`) catches jobs enqueued while Redis was down. Disabled with `IMPORT_EXPORT_ENABLED=false` when running a separate worker process.

## Import Rules

```
config          ← imports nothing from src/
services        ← config
domain          ← domain, services, config, external libs
infrastructure  ← domain, services, config, infrastructure, external libs
```

- `domain` must **never** import from `infrastructure`.
- `services` must **never** import from `infrastructure` or `domain`.
- `infrastructure` is the composition root: it imports domain factories and concrete repository implementations, then wires them together.

## Domain Factory Pattern

Domain modules export **factory functions**, not instantiated objects. The factory declares its dependencies via an interface and the infrastructure caller provides concrete implementations:

```typescript
// domain/helloWorld/helloWorld.ts — exports the factory
function helloWorldDomainFactory(repositories: HelloWorldRepositories) { ... }
export default helloWorldDomainFactory;

// infrastructure/controllers/helloWorld/helloWorld.controller.ts — wires it
import helloWorldDomainFactory from '@domain/helloWorld/helloWorld';
import helloWorldFilesRepository from '@infrastructure/repositories/helloWorldFiles/helloWorldFiles.repository';

const helloWorldDomain = helloWorldDomainFactory({
  helloWorldRepository: helloWorldFilesRepository,
});
```

This keeps domain logic decoupled from any specific repository implementation and makes it easy to swap implementations (e.g. file-based → database-based) by changing only the infrastructure wiring.

## Repository Naming

Repository **interfaces** live in `domain/_repositories/` and are named by the entity they serve:

```
domain/_repositories/helloWorld.repository.ts   # interface HelloWorldRepository
```

Repository **implementations** live in `infrastructure/repositories/` and are named with a suffix that describes the implementation type:

```
infrastructure/repositories/helloWorldFiles/    # file-based implementation
infrastructure/repositories/userDb/             # Postgres implementation
infrastructure/repositories/sessionDb/          # Postgres implementation
```

There is never a bare `helloWorld.repository.ts` in infrastructure — the suffix (`Files`, `Db`, `Memory`, etc.) is always required so it is immediately clear which backing store is used.

## Error Handling and Logging

| Layer            | Approach                                                                                                                                                                                                                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Controllers**  | Catch errors generally (try/catch for every handler). Log them and format responses via `responsesService.createGeneralError()`. Always return a consistent response shape with appropriate status code.                                                                                                        |
| **Repositories** | Catch errors generally (try/catch for every function). Log them and rethrow a controlled Boom error (e.g. `Boom.badImplementation`) with codes from the module's errors file.                                                                                                                                   |
| **Domain**       | Do not catch errors generally. Assert at critical points that required resources exist; throw custom Boom errors when they are missing and necessary for the main operation. For non-critical side effects (e.g. sending an email), optionally try/catch, log failures, and continue—do not fail the main flow. |

### Controller example

```typescript
async changePassword(request: Request, h: ResponseToolkit) {
  let response: IResponseData;
  try {
    await accountDomain.changePassword(userId, token, payload);
    response = responsesService.createResponseData(accountResponses.changePasswordOk);
  } catch (error) {
    logger.error(__filename, 'changePassword', 'error', error as Error);
    response = responsesService.createGeneralError(error as any);
  }
  return h.response(response.body).code(response.statusCode);
}
```

### Repository example

```typescript
async insertJWT(token: string, userId: string, platform: string): Promise<ISession> {
  try {
    const [row] = await sqlService.myDb('session').insert({ ... }).returning('*');
    return { ... };
  } catch (error) {
    logger.error(__filename, 'insertJWT', 'error', error as Error);
    throw Boom.badImplementation(sessionDbErrors.internalError.message, {
      code: sessionDbErrors.internalError.code,
    });
  }
}
```

### Domain example

```typescript
// Critical assertion: throw when required for main operation
const tokenRecord = await emailVerificationTokenRepository.findByToken(payload.token);
if (!tokenRecord) {
  throw Boom.badRequest(registrationErrors.invalidToken.message, {
    code: registrationErrors.invalidToken.code,
  });
}

// Non-critical side effect: log and continue, don't fail the flow
try {
  await emailService.sendMail({ ... });
} catch (error) {
  logger.error(__filename, 'register', 'Failed to send verification email', error as Error);
}
```

## Adapter Placement

Adapters transform data between layers. They always live in the infrastructure layer, **next to the piece they serve**:

- **API-to-Domain / Domain-to-API adapters** — next to the controller that uses them.
  ```
  infrastructure/controllers/helloWorld/helloWorld.adapters.ts
  ```
- **DB-to-Domain / Domain-to-DB adapters** — next to the repository that uses them.
  ```
  infrastructure/repositories/helloWorldFiles/helloWorldFiles.adapters.ts
  ```

## Scripts

```bash
npm run dev         # Start dev server with tsx watch
npm run build       # Compile TypeScript
npm start           # Run compiled output
npm run migrate     # Run Knex migrations
npm run migrate:make my_migration_name   # Create new migration with timestamp
```

## Migrations

Migration filenames use the format `<timestamp>_<descriptive_name>.ts`, where the timestamp is milliseconds since epoch (`Date.now()`). This ensures deterministic ordering and avoids collisions across developers.

- **Scaffolded migrations** — The default migrations bundled with this project use epoch + 0, 1, 2, 3 (`0_create_messages`, `1_create_auth_tables`, etc.).
- **New migrations** — Use `npm run migrate:make your_migration_name` to create a new migration file with the current timestamp. New migrations will run after the scaffolded ones.

## Handover API

Feature specifications for the whole platform are listed in [docs/spec-index.md](../docs/spec-index.md).

Verified custody (magic-link handover) routes live under `infrastructure/routes/admin/handovers/` and `infrastructure/routes/me/handovers/`. Domain logic is in `domain/handovers/handovers.domain.ts`. See [spec-handover-magic-link.md](../docs/spec-handover-magic-link.md) for the full specification.

## Import / Export

Bulk import/export (SPEC-IMPORT-001) is an admin-only hub. Job routes live under `infrastructure/routes/admin/importExport/` (`/api/p/import-jobs`, `/api/p/export-jobs`, `/api/p/import-mapping-presets`, `/api/p/import-templates/{entityType}`), all gated by `JWTAdminOrApiKey` + the `import_export:run` capability. Domain logic is in `domain/importExport/`; it commits each row through the existing entity domains (assets, sites, users, manufacturers, vendors) so all invariants are reused.

Async jobs (dry-run, commit, export) are drained by `infrastructure/proceses/importExportWorker.ts`. The worker blocks on `REDIS_IMPORT_EXPORT_QUEUE` (`IMPORT_WORKER_BLOCK_SECONDS`) and fully drains pending jobs from the DB on each wakeup; the scheduler's `import-export-sweep` (`IMPORT_SAFETY_SWEEP_MS`) is a safety net when Redis was down. In dev the worker runs in-process (started from `proceses/init.ts`); in production run it as a **separate worker process** (D-IMPORT-3) and set `IMPORT_EXPORT_ENABLED=false` on API nodes. Uploaded files and artifacts live under `IMPORT_STORAGE_PATH` and are purged after `IMPORT_ARTIFACT_RETENTION_DAYS` (also via scheduler `import-artifact-purge`). See [spec-import-export.md](../docs/spec-import-export.md).

