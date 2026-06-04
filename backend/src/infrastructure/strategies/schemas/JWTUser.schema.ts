export interface JWTUserSchema {
  id: string;
}

export function isValidJWTUser(payload: unknown): payload is JWTUserSchema {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as JWTUserSchema).id === 'string'
  );
}
