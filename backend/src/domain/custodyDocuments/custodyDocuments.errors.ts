const custodyDocumentErrors = {
  assetNotFound: {
    message: 'Asset not found',
    code: 'CDOC4040',
  },
  documentNotFound: {
    message: 'Custody document not found',
    code: 'CDOC4041',
  },
  fileMissing: {
    message: 'Custody document file is missing',
    code: 'CDOC4042',
  },
  invalidType: {
    message: 'Invalid custody document type',
    code: 'CDOC4001',
  },
  // A CHECK_IN receipt only makes sense for an asset currently held by someone.
  notAssigned: {
    message: 'Asset must be assigned to generate a check-in receipt',
    code: 'CDOC4002',
  },
  // CHECK_OUT needs a recipient; either an explicit target or the current assignee.
  noTargetUser: {
    message: 'A target user is required to generate this receipt',
    code: 'CDOC4003',
  },
  targetUserNotFound: {
    message: 'Target user not found',
    code: 'CDOC4044',
  },
};

export default custodyDocumentErrors;
