export interface AssetDbErrorDescriptor {
  readonly message: string;
  readonly code: string;
}

export interface AssetDbErrors {
  readonly internalError: AssetDbErrorDescriptor;
  readonly serialAlreadyExists: AssetDbErrorDescriptor;
}

const assetDbErrors: AssetDbErrors = {
  internalError: {
    message: 'Asset repository error',
    code: 'AST5001',
  },
  serialAlreadyExists: {
    message: 'An asset with that serial number already exists',
    code: 'AST4090',
  },
};

export default assetDbErrors;
