# Backend Layering: Controllers, Domains, Repositories

## Three-Layer Rule

**Controllers** (`infrastructure/routes/`) — HTTP only. Never call services or repositories directly.
**Domains** (`domain/`) — Business logic. Injected with both DB repositories and injectable service repositories. Deterministic utilities (crypto, captcha, redis, jwt, logger) may still be imported directly.
**Repositories** (`infrastructure/repositories/`) — DB access and injectable services. Concrete implementations wired in controllers.

---

## Controller

Instantiates the domain factory at module level with concrete repositories **and** the chosen service implementation. Controllers pick real vs mock based on `config.mockXxx` flags. Calls domain methods. Formats responses with `responsesService`.

```typescript
// contracts.controller.ts
import config from '@config/config';
import contractDomainFactory from '@domain/contract/contract.domain';
import contractDbRepository from '@infrastructure/repositories/contractDb/contractDb.repository';
import firmaContractService from '@infrastructure/repositories/_services/contractService/firmaContractService';
import mockContractService from '@infrastructure/repositories/_services/contractService/mockContractService';
import userDbRepository from '@infrastructure/repositories/userDb/userDb.repository';

const contractDomain = contractDomainFactory({
  contractRepository: contractDbRepository,
  userRepository: userDbRepository,
  contractService: config.mockContractSignature ? mockContractService : firmaContractService,
});

export const contractsController = {
  initiateSign: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const result = await contractDomain.initiateContractSigning(...);
      response = responsesService.createResponseData(contractResponses.ok, result);
    } catch (error) {
      response = responsesService.createGeneralError(error as any);
    }
    return h.response(response.body).code(response.statusCode);
  },
};
```

## Domain Factory

Receives both DB repository interfaces **and** injectable service repositories via its `repositories` parameter. Services with real/mock variants (email, payment, contract) are injected — never imported directly. Deterministic utilities (crypto, captcha, redis, jwt, logger) may still be imported directly. Contains all business logic. Throws Boom errors.

```typescript
// contract.domain.ts
import { IContractService } from '@domain/_repositories/contractService.repository';

interface ContractRepositories {
  contractRepository: ContractRepository;
  userRepository: UserRepository;
  contractService: IContractService;   // ← injected, not imported
}

function contractDomainFactory(repositories: ContractRepositories) {
  const { contractRepository, userRepository, contractService } = repositories;

  return {
    async initiateContractSigning(authUserId: string, userId: string) {
      if (userId !== authUserId) throw Boom.forbidden('...');
      const user = await userRepository.findById(userId);
      const session = await contractService.initiateContractSigning(...); // via injection
      await contractRepository.create({ ... });
      return session;
    },
  };
}
```

## Repository Interface

DB repositories: defined in `domain/_repositories/`, concrete implementation in `infrastructure/repositories/`. Only the interface is injected into the domain.

Injectable services: same pattern. Interface in `domain/_repositories/xxxService.repository.ts`, real and mock implementations in `infrastructure/repositories/_services/xxx/`.

---

## Injectable Services

Services that need real and mock variants (external APIs) follow the same interface-injection pattern as DB repositories.

**When to create an injectable service:** only for services that call external APIs and genuinely need a mock implementation (e.g., email sending, contract signing, payments). Deterministic in-process utilities (crypto, captcha, logger) are imported directly — they don't need mocking.

**Env flags** in `config.ts` control which implementation is injected:

- `config.mockEmail` → `nodemailerEmailService` vs `mockEmailService`
- `config.mockContractSignature` → `firmaContractService` vs `mockContractService`

Generated apps that include Stripe can point the real `stripePaymentService` at a local HTTP fake by setting `STRIPE_API_HOST` / `STRIPE_API_PORT` / `STRIPE_API_PROTOCOL`. Local dev uses real Stripe test keys with those vars unset.

---

## File Layout (per feature)

```
domain/
  contract/
    contract.domain.ts             ← domain factory
    contract.errors.ts             ← Boom error constants
  _repositories/
    contract.repository.ts         ← DB interface
    contractService.repository.ts  ← injectable service interface

infrastructure/
  repositories/
    contractDb/
      contractDb.repository.ts     ← concrete DB implementation
    _services/
      contractService/
        firmaContractService.ts    ← real service (firma.dev)
        mockContractService.ts     ← mock for tests
      emailService/
        nodemailerEmailService.ts  ← real service (SMTP)
        mockEmailService.ts        ← mock for tests
      paymentService/
        stripePaymentService.ts    ← real service (optional Stripe layer)
  routes/
    contracts/
      contracts.route.ts           ← Hapi route + auth
      contracts.controller.ts      ← wires domain + formats response
      contracts.doc.ts             ← Joi schemas + createResponseDoc
      contracts.responses.ts       ← createInternalResponse constants
```
