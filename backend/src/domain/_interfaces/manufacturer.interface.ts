export interface IManufacturer {
  id: string;
  dateCreated: string;
  dateUpdated: string;
  name: string;
  imageFilename: string | null;
}

export interface IManufacturerWithAssetCount extends IManufacturer {
  assetCount: number;
}

export interface ICreateManufacturer {
  name: string;
}

export interface IUpdateManufacturer {
  name?: string;
}
