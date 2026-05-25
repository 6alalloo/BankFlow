export interface UserFormData {
  full_name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role_id: number | null;
}

export const initialFormData: UserFormData = {
  full_name: "",
  email: "",
  password: "",
  confirmPassword: "",
  role_id: null,
};
