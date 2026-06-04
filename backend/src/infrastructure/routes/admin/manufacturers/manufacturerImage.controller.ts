import catalogImageDomainFactory from '@domain/catalog/catalogImage.domain';
import manufacturerImageErrors from '@domain/manufacturers/image/manufacturerImage.errors';
import manufacturerDbRepository from '@infrastructure/repositories/manufacturerDb/manufacturerDb.repository';
import { createCatalogImageController } from '@routes/admin/catalog/catalogImage.controller';
import manufacturerImageResponses from './manufacturerImage.responses';
import { manufacturerImageStorage } from '@services/uploadedImage.service';

const manufacturerImageDomain = catalogImageDomainFactory(
  manufacturerDbRepository,
  manufacturerImageErrors,
  manufacturerImageStorage,
);

export const manufacturerImageController = createCatalogImageController(
  manufacturerImageDomain,
  manufacturerImageResponses,
  'MFR4002',
  'manufacturer',
);
