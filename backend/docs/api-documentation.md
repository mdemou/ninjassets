# API Documentation Conventions

When adding or modifying backend routes, follow these patterns for Swagger docs.

## File Structure

Each route module has:

- **`.route.ts`** — Route definition (method, path, handler, options)
- **`.doc.ts`** — Validation + hapi-swagger response schemas
- **`.responses.ts`** — Response metadata (`statusCode`, `code`, `message`)

## Use createResponseDoc

Do not manually build Joi schemas for responses. Use the factory from `@infrastructure/routes/doc/docFactory`:

```typescript
// .doc.ts
import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import someResponses from './some.responses';

const someDocs = {
  myEndpoint: {
    responses: createResponseDoc('myEndpoint', someResponses.okResponse, {
      dataSchema: Joi.object({
        /* optional payload for 200 */
      }),
      400: someResponses.badRequest(400, 'Validation error'),
      401: true, // Boom unauthorized format
      409: { statusCode: 409, code: 'XXX4090', message: '...' },
      500: { statusCode: 500, code: 'XXX5001', message: '...' },
    }),
    parameters: {
      payload: Joi.object({
        /* ... */
      }),
      headers: Joi.object({ authorization: Joi.string().required() }).unknown(),
      failAction: createValidationFailAction(someResponses.badRequest),
    },
  },
};
```

## Route Wiring

```typescript
// .route.ts
options: {
  plugins: {
    'hapi-swagger': { responses: someDocs.myEndpoint.responses },
  },
  validate: someDocs.myEndpoint.parameters,
  tags: ['api', 'group-name'],
}
```

## Response Metadata

Define in `.responses.ts` via `responsesService.createInternalResponse(statusCode, code, message)`. Reuse these in both controllers and `createResponseDoc`.

## Swagger UI

Documentation is served at `/docs` (not `/documentation`). JSON spec at `/docs.json`.
