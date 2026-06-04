const passwordResetErrors = {
  invalidToken: {
    message: 'Invalid or expired reset token',
    code: 'PWR4001',
  },
  userNotFound: {
    message: 'Password reset failed',
    code: 'PWR4002',
  },
  internalError: {
    message: 'Password reset service error',
    code: 'PWR5001',
  },
};

export default passwordResetErrors;
