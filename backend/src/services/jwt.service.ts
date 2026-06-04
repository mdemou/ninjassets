import jwt from 'jsonwebtoken';

const jwtService = {
  sign(payload: object, secretKey: string): string {
    return jwt.sign(payload, secretKey);
  },

  verify(token: string, secretKey: string): object | string {
    return jwt.verify(token, secretKey);
  },
};

export default jwtService;
