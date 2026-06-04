const webhookErrors = {
  destinationNotFound: {
    message: 'Webhook destination not found',
    code: 'WHK4040',
  },
  invalidName: {
    message: 'A non-empty name is required',
    code: 'WHK4001',
  },
  invalidPlatform: {
    message: 'platform must be one of: slack, discord, telegram',
    code: 'WHK4002',
  },
  invalidTarget: {
    message: 'Invalid target for the selected platform',
    code: 'WHK4003',
  },
  invalidEvents: {
    message: 'subscribedEvents contains an unknown event type',
    code: 'WHK4004',
  },
  testFailed: {
    message: 'Test delivery failed',
    code: 'WHK4005',
  },
};

export default webhookErrors;
