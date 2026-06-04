const apiKeyErrors = {
  keyNotFound: {
    message: 'API key not found',
    code: 'API4040',
  },
  invalidName: {
    message: 'A non-empty name is required',
    code: 'API4001',
  },
  invalidExpiry: {
    message: 'expiresAt must be a future date',
    code: 'API4002',
  },
  alreadyRevoked: {
    message: 'API key is already revoked',
    code: 'API4003',
  },
};

export default apiKeyErrors;
