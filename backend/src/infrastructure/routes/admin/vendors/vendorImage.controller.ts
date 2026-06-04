import catalogImageDomainFactory from '@domain/catalog/catalogImage.domain';
import vendorImageErrors from '@domain/vendors/image/vendorImage.errors';
import vendorDbRepository from '@infrastructure/repositories/vendorDb/vendorDb.repository';
import { createCatalogImageController } from '@routes/admin/catalog/catalogImage.controller';
import { vendorImageStorage } from '@services/uploadedImage.service';
import vendorImageResponses from './vendorImage.responses';

const vendorImageDomain = catalogImageDomainFactory(
  vendorDbRepository,
  vendorImageErrors,
  vendorImageStorage,
);

export const vendorImageController = createCatalogImageController(
  vendorImageDomain,
  vendorImageResponses,
  'VND4002',
  'vendor',
);
