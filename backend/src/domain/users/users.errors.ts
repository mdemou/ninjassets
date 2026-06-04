const userErrors = {
  invalidPassword: {
    message: 'Current password is incorrect',
    code: 'ACC4001',
  },
  userNotFound: {
    message: 'User not found',
    code: 'ACC4003',
  },
  internalError: {
    message: 'Account service error',
    code: 'ACC5001',
  },
};

export default userErrors;
