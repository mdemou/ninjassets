export interface IRegister {
  email: string;
  displayName: string;
  password: string;
  passwordConfirmation: string;
  captchaToken: string;
}

export interface IVerifyEmail {
  token: string;
}

export interface IResendVerification {
  email: string;
}
