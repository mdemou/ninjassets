export interface JWTAdminSchema {
  id: string;
}

export function isValidJWTAdmin(payload: unknown): payload is JWTAdminSchema {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as JWTAdminSchema).id === 'string'
  );
}
