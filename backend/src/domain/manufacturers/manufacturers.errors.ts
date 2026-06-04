const manufacturerErrors = {
  notFound: {
    message: 'Manufacturer not found',
    code: 'MFR4040',
  },
  nameAlreadyExists: {
    message: 'A manufacturer with this name already exists',
    code: 'MFR4090',
  },
  inUse: (count: number) => ({
    message: `Manufacturer is in use by ${count} asset(s)`,
    code: 'MFR4091',
  }),
};

export default manufacturerErrors;
