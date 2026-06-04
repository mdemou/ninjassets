export interface IVendor {
  id: string;
  dateCreated: string;
  dateUpdated: string;
  name: string;
  imageFilename: string | null;
}

export interface IVendorWithAssetCount extends IVendor {
  assetCount: number;
}

export interface ICreateVendor {
  name: string;
}

export interface IUpdateVendor {
  name?: string;
}
