export interface AssetErrorDescriptor {
  readonly message: string;
  readonly code: string;
}

export const ASSET_BAD_REQUEST_CODE = 'AST4001';

export interface AssetErrors {
  readonly assetNotFound: AssetErrorDescriptor;
  readonly serialAlreadyExists: AssetErrorDescriptor;
  readonly assignedUserRequired: AssetErrorDescriptor;
  readonly assignedUserNotFound: AssetErrorDescriptor;
  readonly siteNotFound: AssetErrorDescriptor;
  readonly manufacturerNotFound: AssetErrorDescriptor;
  readonly vendorNotFound: AssetErrorDescriptor;
  readonly parentNotFound: AssetErrorDescriptor;
  readonly categoryNotFound: AssetErrorDescriptor;
  readonly forbidden: AssetErrorDescriptor;
  readonly openHandoverBlocks: AssetErrorDescriptor;
  readonly badRequest: (message: string) => AssetErrorDescriptor;
}

const assetErrors: AssetErrors = {
  assetNotFound: {
    message: 'Asset not found',
    code: 'AST4040',
  },
  serialAlreadyExists: {
    message: 'An asset with that serial number already exists',
    code: 'AST4090',
  },
  assignedUserRequired: {
    message: 'assignedUserId is required when status is ASSIGNED',
    code: 'AST4001',
  },
  assignedUserNotFound: {
    message: 'The user to assign this asset to does not exist',
    code: 'AST4002',
  },
  siteNotFound: {
    message: 'The site to link this asset to does not exist',
    code: 'AST4003',
  },
  manufacturerNotFound: {
    message: 'The manufacturer does not exist',
    code: 'AST4004',
  },
  vendorNotFound: {
    message: 'The vendor does not exist',
    code: 'AST4005',
  },
  parentNotFound: {
    message: 'The parent asset does not exist',
    code: 'AST4006',
  },
  categoryNotFound: {
    message: 'The category does not exist',
    code: 'AST4007',
  },
  forbidden: {
    message: 'You do not have access to this asset',
    code: 'AST4030',
  },
  openHandoverBlocks: {
    message:
      'This asset has an open handover. Cancel or complete it before changing status or assignment.',
    code: 'AST4091',
  },
  badRequest: (message: string): AssetErrorDescriptor => ({
    message,
    code: ASSET_BAD_REQUEST_CODE,
  }),
};

export default assetErrors;
