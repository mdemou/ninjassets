export interface ImportExportDbErrorDescriptor {
  readonly message: string;
  readonly code: string;
}

const importJobDbErrors = {
  internalError: {
    message: 'Import job repository error',
    code: 'IEX5001',
  } as ImportExportDbErrorDescriptor,
};

export default importJobDbErrors;
