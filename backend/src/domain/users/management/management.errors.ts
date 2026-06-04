const managementErrors = {
  userNotFound: {
    message: 'User not found',
    code: 'ADU4001',
  },
  emailAlreadyExists: {
    message: 'Email already exists',
    code: 'ADU4002',
  },
  invalidRole: {
    message: 'Invalid role',
    code: 'ADU4003',
  },
  badRequest: (message: string) => ({
    message,
    code: 'ADU4001',
  }),
};

export default managementErrors;
