const sessionErrors = {
  invalidCredentials: {
    message: 'Invalid email or password',
    code: 'AUTH4001',
  },
  invalidCaptcha: {
    message: 'Invalid captcha',
    code: 'AUTH4002',
  },
  unauthorized: {
    message: 'Unauthorized',
    code: 'AUTH4010',
  },
  forbidden: {
    message: 'Forbidden',
    code: 'AUTH4030',
  },
  userNotFound: {
    message: 'User not found',
    code: 'AUTH4041',
  },
  accountLocked: {
    message: 'Account temporarily locked due to too many failed attempts',
    code: 'AUTH4291',
  },
  internalError: {
    message: 'Session service error',
    code: 'AUTH5001',
  },
};

export default sessionErrors;
