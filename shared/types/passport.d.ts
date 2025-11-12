import type { User as AppUser } from './user';

declare global {
  namespace Express {
    interface User extends AppUser {
      _id: string;
    }
  }
}
