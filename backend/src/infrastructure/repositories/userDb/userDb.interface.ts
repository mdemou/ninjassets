export interface IUserDB {
  id: string;
  date_created: string;
  email: string;
  display_name: string;
  hashed: string;
  salt: string;
  role_id: number;
  status: string;
  avatar_filename: string | null;
}

export interface IUserWithRoleDB extends IUserDB {
  role_name: string;
}
