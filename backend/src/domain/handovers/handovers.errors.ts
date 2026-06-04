const handoverErrors = {
  assetNotFound: {
    message: 'Asset not found',
    code: 'HND4040',
  },
  handoverNotFound: {
    message: 'Handover not found',
    code: 'HND4041',
  },
  openHandoverExists: {
    message: 'An open handover already exists for this asset',
    code: 'HND4090',
  },
  invalidStatusForCheckout: {
    message: 'Asset must be in STOCK to start a verified checkout',
    code: 'HND4001',
  },
  invalidStatusForCheckin: {
    message: 'Asset must be ASSIGNED to start a verified return',
    code: 'HND4002',
  },
  targetUserNotFound: {
    message: 'The target user does not exist',
    code: 'HND4003',
  },
  targetUserInactive: {
    message: 'The target user is not active',
    code: 'HND4004',
  },
  checkinTargetMismatch: {
    message: 'The return must target the current assignee of the asset',
    code: 'HND4005',
  },
  invalidToken: {
    message: 'This link is not valid',
    code: 'HND4006',
  },
  tokenExpired: {
    message: 'This link has expired',
    code: 'HND4007',
  },
  tokenAlreadyUsed: {
    message: 'This link has already been used',
    code: 'HND4008',
  },
  wrongRecipient: {
    message: 'This link is not valid',
    code: 'HND4030',
  },
  assigneeChanged: {
    message: 'The asset assignee has changed since this handover was created',
    code: 'HND4091',
  },
};

export default handoverErrors;
