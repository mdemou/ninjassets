const categoryErrors = {
  notFound: {
    message: 'Category not found',
    code: 'CAT4040',
  },
  nameAlreadyExists: {
    message: 'A category with this name already exists',
    code: 'CAT4090',
  },
  inUse: (count: number) => ({
    message: `Category is in use by ${count} asset(s)`,
    code: 'CAT4091',
  }),
  badRequest: (message: string) => ({
    message,
    code: 'CAT4001',
  }),
};

export default categoryErrors;
