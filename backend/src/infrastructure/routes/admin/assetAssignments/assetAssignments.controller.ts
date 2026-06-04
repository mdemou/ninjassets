import assetAssignmentDomainFactory, {
  type AssetAssignmentDomain,
  type BulkAssignInput,
} from '@domain/assetAssignments/assetAssignments.domain';
import assetDomainFactory, { type AssetDomain } from '@domain/assets/assets.domain';
import handoverDomainFactory, { type HandoverDomain } from '@domain/handovers/handovers.domain';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import assetDbRepository from '@infrastructure/repositories/assetDb/assetDb.repository';
import categoryDbRepository from '@infrastructure/repositories/categoryDb/categoryDb.repository';
import handoverDbRepository from '@infrastructure/repositories/handoverDb/handoverDb.repository';
import manufacturerDbRepository from '@infrastructure/repositories/manufacturerDb/manufacturerDb.repository';
import siteDbRepository from '@infrastructure/repositories/siteDb/siteDb.repository';
import transactionDbRepository from '@infrastructure/repositories/transactionDb/transactionDb.repository';
import userDbRepository from '@infrastructure/repositories/userDb/userDb.repository';
import vendorDbRepository from '@infrastructure/repositories/vendorDb/vendorDb.repository';
import logger from '@services/logger.service';
import { IResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';
import assetAssignmentsResponses from './assetAssignments.responses';

// Direct bulk assignment is gated by the open-handover block policy (policy A),
// so this asset domain is wired WITH the handover-block repository — same as the
// admin PATCH path.
const blockingAssetDomain: AssetDomain = assetDomainFactory({
  assetRepository: assetDbRepository,
  userRepository: userDbRepository,
  siteRepository: siteDbRepository,
  transactionRepository: transactionDbRepository,
  manufacturerRepository: manufacturerDbRepository,
  vendorRepository: vendorDbRepository,
  categoryRepository: categoryDbRepository,
  handoverRepository: handoverDbRepository,
});

// The handover create flow applies the asset change itself (without the block
// repo), mirroring how handovers.controller wires its asset domain.
const handoverAssetDomain: AssetDomain = assetDomainFactory({
  assetRepository: assetDbRepository,
  userRepository: userDbRepository,
  siteRepository: siteDbRepository,
  transactionRepository: transactionDbRepository,
  manufacturerRepository: manufacturerDbRepository,
  vendorRepository: vendorDbRepository,
  categoryRepository: categoryDbRepository,
});

const handoverDomain: HandoverDomain = handoverDomainFactory({
  handoverRepository: handoverDbRepository,
  assetRepository: assetDbRepository,
  userRepository: userDbRepository,
  transactionRepository: transactionDbRepository,
  assetDomain: handoverAssetDomain,
});

const assetAssignmentDomain: AssetAssignmentDomain = assetAssignmentDomainFactory({
  assetDomain: blockingAssetDomain,
  handoverDomain,
});

function getRequester(request: Request): { id: string; role: string } {
  const credentials = request.auth.credentials as { id: string; role: string };
  return { id: credentials.id, role: credentials.role };
}

export const assetAssignmentsController = {
  bulkAssign: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const payload = request.payload as BulkAssignInput;
      const result = await assetAssignmentDomain.bulkAssign(getRequester(request), payload);
      response = responsesService.createResponseData(assetAssignmentsResponses.bulkOk, result);
    } catch (error) {
      logger.error(__filename, 'bulkAssign', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },
};
