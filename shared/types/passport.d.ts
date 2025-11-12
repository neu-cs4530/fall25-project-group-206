import { User } from './types/types';

declare global {
  namespace Express {
    interface User extends User {}
  }
}
