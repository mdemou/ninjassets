const siteErrors = {
  siteNotFound: {
    message: 'Site not found',
    code: 'STE4040',
  },
  badRequest: (message: string) => ({
    message,
    code: 'STE4001',
  }),
};

export default siteErrors;
