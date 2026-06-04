export interface ISession {
  id: string;
  dateCreated: string;
  tokenVal: string;
  status: boolean;
  fkUserId: string;
  platform: string | null;
}

export interface ISessionWithUser {
  id: string;
  tokenVal: string;
  userId: string;
  email: string;
  displayName: string;
  roleName: string;
  status: string;
}

export interface ILogin {
  email: string;
  password: string;
  captchaToken: string;
  platform: string;
}

export interface ILoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    roleName: string;
    avatarFilename: string | null;
  };
}

export interface IMeResponse {
  user: {
    id: string;
    dateCreated: string;
    email: string;
    displayName: string;
    roleName: string;
    avatarFilename: string | null;
  };
}
