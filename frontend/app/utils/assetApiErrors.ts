import type { ApiResponse } from '~/types';
import type { TranslationKey } from '~/utils/translations';

export const ASSET_SERIAL_EXISTS_CODE = 'AST4090';

export function isAssetSerialAlreadyExistsError(error: ApiResponse): boolean {
  return error.code === ASSET_SERIAL_EXISTS_CODE;
}

export function assetSerialAlreadyExistsMessage(t: (key: TranslationKey) => string): string {
  return t('assets.serialAlreadyExists');
}

export function resolveAssetApiErrorMessage(
  error: ApiResponse,
  t: (key: TranslationKey) => string,
): string {
  if (isAssetSerialAlreadyExistsError(error)) {
    return assetSerialAlreadyExistsMessage(t);
  }
  return error.message || t('common.error');
}
