import responsesService from '@services/responses/responses.service';

const importExportResponses = {
  importJobCreated: responsesService.createInternalResponse(200, 'IEX2001', 'Import job created'),
  importJobOk: responsesService.createInternalResponse(200, 'IEX2002', 'Import job retrieved'),
  importJobsOk: responsesService.createInternalResponse(200, 'IEX2003', 'Import jobs retrieved'),
  mappingOk: responsesService.createInternalResponse(200, 'IEX2004', 'Mapping saved'),
  dryRunStarted: responsesService.createInternalResponse(200, 'IEX2005', 'Dry-run started'),
  commitStarted: responsesService.createInternalResponse(200, 'IEX2006', 'Commit started'),
  cancelled: responsesService.createInternalResponse(200, 'IEX2007', 'Import job cancelled'),
  rowsOk: responsesService.createInternalResponse(200, 'IEX2008', 'Import rows retrieved'),
  exportJobCreated: responsesService.createInternalResponse(200, 'IEX2010', 'Export job created'),
  exportJobOk: responsesService.createInternalResponse(200, 'IEX2011', 'Export job retrieved'),
  exportJobsOk: responsesService.createInternalResponse(200, 'IEX2012', 'Export jobs retrieved'),
  jobHistoryOk: responsesService.createInternalResponse(200, 'IEX2013', 'Import/export history retrieved'),
  presetsOk: responsesService.createInternalResponse(200, 'IEX2020', 'Presets retrieved'),
  presetCreated: responsesService.createInternalResponse(200, 'IEX2021', 'Preset created'),
  presetDeleted: responsesService.createInternalResponse(200, 'IEX2022', 'Preset deleted'),
  badRequest: (statusCode: number, message: string) => {
    return responsesService.createInternalResponse(statusCode, 'IEX4001', message);
  },
};

export default importExportResponses;
