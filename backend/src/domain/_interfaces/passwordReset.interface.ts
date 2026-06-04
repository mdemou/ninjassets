export interface IForgotPasswordPayload {
  email: string;
}

export interface IResetPasswordPayload {
  token: string;
  password: string;
  passwordConfirmation: string;
}
