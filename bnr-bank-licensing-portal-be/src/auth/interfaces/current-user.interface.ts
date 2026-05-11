import { UserRole } from '../../common/enums/user-role.enum';

export interface CurrentUser {
  id: string;
  email: string;
  role: UserRole;
}
