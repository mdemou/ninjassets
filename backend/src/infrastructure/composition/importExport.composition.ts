/**
 * Composition root for the import/export hub (SPEC-IMPORT-001). Wires the job
 * repositories, the entity domains the importer commits through, and the lookup
 * repositories used for name resolution and export. Shared by the HTTP controller
 * and the background worker so both operate on one configured instance.
 */
import assetDomainFactory from '@domain/assets/assets.domain';
import siteDomainFactory from '@domain/sites/sites.domain';
import manufacturerDomainFactory from '@domain/manufacturers/manufacturers.domain';
import vendorDomainFactory from '@domain/vendors/vendors.domain';
import managementDomainFactory from '@domain/users/management/management.domain';
import importExportDomainFactory from '@domain/importExport/importExport.domain';

import assetDbRepository from '@infrastructure/repositories/assetDb/assetDb.repository';
import siteDbRepository from '@infrastructure/repositories/siteDb/siteDb.repository';
import manufacturerDbRepository from '@infrastructure/repositories/manufacturerDb/manufacturerDb.repository';
import vendorDbRepository from '@infrastructure/repositories/vendorDb/vendorDb.repository';
import categoryDbRepository from '@infrastructure/repositories/categoryDb/categoryDb.repository';
import userDbRepository from '@infrastructure/repositories/userDb/userDb.repository';
import handoverDbRepository from '@infrastructure/repositories/handoverDb/handoverDb.repository';
import transactionDbRepository from '@infrastructure/repositories/transactionDb/transactionDb.repository';
import passwordResetTokenDbRepository from '@infrastructure/repositories/passwordResetTokenDb/passwordResetTokenDb.repository';
import sessionDbRepository from '@infrastructure/repositories/sessionDb/sessionDb.repository';
import importJobDbRepository from '@infrastructure/repositories/importJobDb/importJobDb.repository';
import exportJobDbRepository from '@infrastructure/repositories/exportJobDb/exportJobDb.repository';
import importMappingPresetDbRepository from '@infrastructure/repositories/importMappingPresetDb/importMappingPresetDb.repository';

import config from '@config/config';
import redisService from '@services/redis.service';

const importExportQueueKey = config.db.redis.queues.importExportJobs;

const assetDomain = assetDomainFactory({
  assetRepository: assetDbRepository,
  userRepository: userDbRepository,
  siteRepository: siteDbRepository,
  transactionRepository: transactionDbRepository,
  manufacturerRepository: manufacturerDbRepository,
  vendorRepository: vendorDbRepository,
  categoryRepository: categoryDbRepository,
  // Import commits honour the open-handover block (policy A) unless force is set.
  handoverRepository: handoverDbRepository,
});
const siteDomain = siteDomainFactory({ siteRepository: siteDbRepository });
const manufacturerDomain = manufacturerDomainFactory({ manufacturerRepository: manufacturerDbRepository });
const vendorDomain = vendorDomainFactory({ vendorRepository: vendorDbRepository });
const userManagementDomain = managementDomainFactory({
  userRepository: userDbRepository,
  passwordResetTokenRepository: passwordResetTokenDbRepository,
  sessionRepository: sessionDbRepository,
});

const importExportDomain = importExportDomainFactory({
  importJobRepository: importJobDbRepository,
  exportJobRepository: exportJobDbRepository,
  presetRepository: importMappingPresetDbRepository,
  domains: {
    asset: assetDomain,
    site: siteDomain,
    manufacturer: manufacturerDomain,
    vendor: vendorDomain,
    user: userManagementDomain,
  },
  repos: {
    asset: assetDbRepository,
    site: siteDbRepository,
    manufacturer: manufacturerDbRepository,
    vendor: vendorDbRepository,
    user: userDbRepository,
    category: categoryDbRepository,
    handover: handoverDbRepository,
  },
  exportRepos: {
    asset: assetDbRepository,
    site: siteDbRepository,
    manufacturer: manufacturerDbRepository,
    vendor: vendorDbRepository,
    user: userDbRepository,
  },
  enqueue: async (message: string) => {
    await redisService.rpush(importExportQueueKey, message);
  },
});

export default importExportDomain;
