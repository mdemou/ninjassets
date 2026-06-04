const registrationErrors = {
  emailAlreadyExists: {
    message: 'Email already exists',
    code: 'REG4001',
  },
  invalidCaptcha: {
    message: 'Invalid captcha',
    code: 'REG4003',
  },
  signupDisabled: {
    message: 'Registration is disabled',
    code: 'REG4030',
  },
  invalidToken: {
    message: 'Invalid or expired verification token',
    code: 'REG4004',
  },
  userNotFound: {
    message: 'Verification failed',
    code: 'REG4005',
  },
  alreadyVerified: {
    message: 'Email already verified',
    code: 'REG4006',
  },
  invalidRole: {
    message: 'Invalid role',
    code: 'REG4007',
  },
  internalError: {
    message: 'Registration service error',
    code: 'REG5001',
  },
};

export default registrationErrors;
