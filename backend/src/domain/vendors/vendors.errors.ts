const vendorErrors = {
  notFound: {
    message: 'Vendor not found',
    code: 'VND4040',
  },
  nameAlreadyExists: {
    message: 'A vendor with this name already exists',
    code: 'VND4090',
  },
  inUse: (count: number) => ({
    message: `Vendor is in use by ${count} asset(s)`,
    code: 'VND4091',
  }),
};

export default vendorErrors;
