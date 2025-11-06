import mongoose, { Query } from 'mongoose';
import UserModel from '../../models/users.model';
import {
  deleteUserByUsername,
  getUserByUsername,
  getUsersList,
  loginUser,
  saveUser,
  updateUser,
  toggleFollowUser,
  getFollowers,
  getFollowing,
} from '../../services/user.service';
import { SafeDatabaseUser, User, UserCredentials } from '../../types/types';
import { user, safeUser } from '../mockData.models';

describe('User model', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('saveUser', () => {
    it('should return the saved user', async () => {
      jest
        .spyOn(UserModel, 'create')
        .mockResolvedValueOnce({ ...user, _id: mongoose.Types.ObjectId } as unknown as ReturnType<
          typeof UserModel.create<User>
        >);

      const savedUser = (await saveUser(user)) as SafeDatabaseUser;

      expect(savedUser._id).toBeDefined();
      expect(savedUser.username).toEqual(user.username);
      expect(savedUser.dateJoined).toEqual(user.dateJoined);
    });

    it('should throw an error if error when saving to database', async () => {
      jest
        .spyOn(UserModel, 'create')
        .mockRejectedValueOnce(() => new Error('Error saving document'));

      const saveError = await saveUser(user);

      expect('error' in saveError).toBe(true);
    });

    it('should return error when create returns null', async () => {
      jest.spyOn(UserModel, 'create').mockResolvedValueOnce(null as any);

      const saveError = await saveUser(user);

      expect('error' in saveError).toBe(true);
    });
  });
});

describe('getUserByUsername', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return the matching user', async () => {
    jest.spyOn(UserModel, 'findOne').mockImplementation((filter?: any) => {
      expect(filter.username).toBeDefined();
      const query: any = {};
      query.select = jest.fn().mockReturnValue(Promise.resolve(user));
      return query;
    });

    const retrievedUser = (await getUserByUsername(user.username)) as SafeDatabaseUser;

    expect(retrievedUser.username).toEqual(user.username);
    expect(retrievedUser.dateJoined).toEqual(user.dateJoined);
  });

  it('should throw an error if the user is not found', async () => {
    jest.spyOn(UserModel, 'findOne').mockResolvedValueOnce(null);

    const getUserError = await getUserByUsername(user.username);

    expect('error' in getUserError).toBe(true);
  });

  it('should return error when findOne returns null with select', async () => {
    jest.spyOn(UserModel, 'findOne').mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    } as unknown as Query<SafeDatabaseUser, typeof UserModel>);

    const getUserError = await getUserByUsername(user.username);

    expect('error' in getUserError).toBe(true);
  });

  it('should throw an error if there is an error while searching the database', async () => {
    jest.spyOn(UserModel, 'findOne').mockReturnValue({
      select: jest.fn().mockRejectedValue(new Error('Error finding document')),
    } as unknown as Query<SafeDatabaseUser, typeof UserModel>);

    const getUserError = await getUserByUsername(user.username);

    expect('error' in getUserError).toBe(true);
  });
});

describe('getUsersList', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return the users', async () => {
    jest.spyOn(UserModel, 'find').mockReturnValue({
      select: jest.fn().mockResolvedValue([safeUser]),
    } as unknown as Query<SafeDatabaseUser[], typeof UserModel>);

    const retrievedUsers = (await getUsersList()) as SafeDatabaseUser[];

    expect(retrievedUsers[0].username).toEqual(safeUser.username);
    expect(retrievedUsers[0].dateJoined).toEqual(safeUser.dateJoined);
  });

  it('should throw an error if the users cannot be found', async () => {
    jest.spyOn(UserModel, 'find').mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    } as unknown as Query<SafeDatabaseUser[], typeof UserModel>);

    const getUsersError = await getUsersList();

    expect('error' in getUsersError).toBe(true);
  });

  it('should throw an error if there is an error while searching the database', async () => {
    jest.spyOn(UserModel, 'find').mockReturnValue({
      select: jest.fn().mockRejectedValue(new Error('Error finding documents')),
    } as unknown as Query<SafeDatabaseUser[], typeof UserModel>);

    const getUsersError = await getUsersList();

    expect('error' in getUsersError).toBe(true);
  });
});

describe('loginUser', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return the user if authentication succeeds', async () => {
    jest.spyOn(UserModel, 'findOne').mockImplementation((filter?: any) => {
      expect(filter.username).toBeDefined();
      expect(filter.password).toBeDefined();
      const query: any = {};
      query.select = jest.fn().mockReturnValue(Promise.resolve(safeUser));
      return query;
    });

    const credentials: UserCredentials = {
      username: user.username,
      password: user.password,
    };

    const loggedInUser = (await loginUser(credentials)) as SafeDatabaseUser;

    expect(loggedInUser.username).toEqual(user.username);
    expect(loggedInUser.dateJoined).toEqual(user.dateJoined);
  });

  it('should return the user if the password fails', async () => {
    jest.spyOn(UserModel, 'findOne').mockResolvedValueOnce(null);

    const credentials: UserCredentials = {
      username: user.username,
      password: 'wrongPassword',
    };

    const loginError = await loginUser(credentials);

    expect('error' in loginError).toBe(true);
  });

  it('should return the user is not found', async () => {
    jest.spyOn(UserModel, 'findOne').mockResolvedValueOnce(null);

    const credentials: UserCredentials = {
      username: 'wrongUsername',
      password: user.password,
    };

    const loginError = await loginUser(credentials);

    expect('error' in loginError).toBe(true);
  });

  it('should return error when findOne returns null with select in loginUser', async () => {
    jest.spyOn(UserModel, 'findOne').mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    } as unknown as Query<SafeDatabaseUser, typeof UserModel>);

    const credentials: UserCredentials = {
      username: user.username,
      password: user.password,
    };

    const loginError = await loginUser(credentials);

    expect('error' in loginError).toBe(true);
  });
});

describe('deleteUserByUsername', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return the deleted user when deleted succesfully', async () => {
    jest.spyOn(UserModel, 'findOneAndDelete').mockImplementation((filter?: any) => {
      expect(filter.username).toBeDefined();
      const query: any = {};
      query.select = jest.fn().mockReturnValue(Promise.resolve(safeUser));
      return query;
    });

    const deletedUser = (await deleteUserByUsername(user.username)) as SafeDatabaseUser;

    expect(deletedUser.username).toEqual(user.username);
    expect(deletedUser.dateJoined).toEqual(user.dateJoined);
  });

  it('should throw an error if the username is not found', async () => {
    jest.spyOn(UserModel, 'findOneAndDelete').mockResolvedValue(null);

    const deletedError = await deleteUserByUsername(user.username);

    expect('error' in deletedError).toBe(true);
  });

  it('should return error when findOneAndDelete returns null with select', async () => {
    jest.spyOn(UserModel, 'findOneAndDelete').mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    } as unknown as Query<SafeDatabaseUser, typeof UserModel>);

    const deletedError = await deleteUserByUsername(user.username);

    expect('error' in deletedError).toBe(true);
  });

  it('should throw an error if a database error while deleting', async () => {
    jest.spyOn(UserModel, 'findOneAndDelete').mockReturnValue({
      select: jest.fn().mockRejectedValue(new Error('Error deleting document')),
    } as unknown as Query<SafeDatabaseUser, typeof UserModel>);

    const deletedError = await deleteUserByUsername(user.username);

    expect('error' in deletedError).toBe(true);
  });
});

describe('updateUser', () => {
  const updatedUser: User = {
    ...user,
    password: 'newPassword',
  };

  const safeUpdatedUser: SafeDatabaseUser = {
    _id: new mongoose.Types.ObjectId(),
    username: user.username,
    dateJoined: user.dateJoined,
    followers: user.followers,
    following: user.following,
  };

  const updates: Partial<User> = {
    password: 'newPassword',
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return the updated user when updated succesfully', async () => {
    jest.spyOn(UserModel, 'findOneAndUpdate').mockImplementation((filter?: any) => {
      expect(filter.username).toBeDefined();
      const query: any = {};
      query.select = jest.fn().mockReturnValue(Promise.resolve(safeUpdatedUser));
      return query;
    });

    const result = (await updateUser(user.username, updates)) as SafeDatabaseUser;

    expect(result.username).toEqual(user.username);
    expect(result.username).toEqual(updatedUser.username);
    expect(result.dateJoined).toEqual(user.dateJoined);
    expect(result.dateJoined).toEqual(updatedUser.dateJoined);
  });

  it('should throw an error if the username is not found', async () => {
    jest.spyOn(UserModel, 'findOneAndUpdate').mockResolvedValueOnce(null);

    const updatedError = await updateUser(user.username, updates);

    expect('error' in updatedError).toBe(true);
  });

  it('should return error when findOneAndUpdate returns null with select', async () => {
    jest.spyOn(UserModel, 'findOneAndUpdate').mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    } as unknown as Query<SafeDatabaseUser, typeof UserModel>);

    const updatedError = await updateUser(user.username, updates);

    expect('error' in updatedError).toBe(true);
  });

  it('should throw an error if a database error while deleting', async () => {
    jest.spyOn(UserModel, 'findOneAndUpdate').mockReturnValue({
      select: jest.fn().mockRejectedValue(new Error('Error updating document')),
    } as unknown as Query<SafeDatabaseUser, typeof UserModel>);

    const updatedError = await updateUser(user.username, updates);

    expect('error' in updatedError).toBe(true);
  });

  it('should update the biography if the user is found', async () => {
    const newBio = 'This is a new biography';
    const biographyUpdates: Partial<User> = { biography: newBio };
    jest.spyOn(UserModel, 'findOneAndUpdate').mockImplementation((filter?: any) => {
      expect(filter.username).toBeDefined();
      const query: any = {};
      query.select = jest
        .fn()
        .mockReturnValue(Promise.resolve({ ...safeUpdatedUser, biography: newBio }));
      return query;
    });

    const result = await updateUser(user.username, biographyUpdates);

    // Check that the result is a SafeUser and the biography got updated
    if ('username' in result) {
      expect(result.biography).toEqual(newBio);
    } else {
      throw new Error('Expected a safe user, got an error object.');
    }
  });

  it('should return an error if biography update fails because user not found', async () => {
    // Simulate user not found
    jest.spyOn(UserModel, 'findOneAndUpdate').mockResolvedValueOnce(null);

    const newBio = 'No user found test';
    const biographyUpdates: Partial<User> = { biography: newBio };
    const updatedError = await updateUser(user.username, biographyUpdates);

    expect('error' in updatedError).toBe(true);
  });
});

describe('toggleFollowUser', () => {
  const currentUser: SafeDatabaseUser = {
    _id: new mongoose.Types.ObjectId(),
    ...user,
    followers: [],
    following: [],
  };

  const targetUser: SafeDatabaseUser = {
    username: 'targetUser',
    dateJoined: new Date(),
    biography: 'Target user bio',
    followers: [],
    following: [],
    _id: new mongoose.Types.ObjectId(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should follow a user when not already following', async () => {
    const mockCurrentUser = {
      ...currentUser,
      following: [],
    };

    const mockTargetUser = {
      ...targetUser,
      followers: [],
    };

    const updatedCurrentUser = {
      ...mockCurrentUser,
      following: [mockTargetUser._id],
    };

    jest
      .spyOn(UserModel, 'findOne')
      .mockResolvedValueOnce(mockCurrentUser)
      .mockResolvedValueOnce(mockTargetUser);

    jest
      .spyOn(UserModel, 'findByIdAndUpdate')
      .mockResolvedValueOnce(updatedCurrentUser)
      .mockResolvedValueOnce({ ...mockTargetUser, followers: [mockCurrentUser._id] });

    const result = await toggleFollowUser(currentUser.username, targetUser.username);

    if (!('error' in result)) {
      expect(result.following).toContainEqual(mockTargetUser._id);
    }
  });

  it('should unfollow a user when already following', async () => {
    const mockCurrentUser = {
      ...currentUser,
      following: [targetUser._id],
    };

    const mockTargetUser = {
      ...targetUser,
      followers: [currentUser._id],
    };

    const updatedCurrentUser = {
      ...mockCurrentUser,
      following: [],
    };

    jest
      .spyOn(UserModel, 'findOne')
      .mockResolvedValueOnce(mockCurrentUser)
      .mockResolvedValueOnce(mockTargetUser);

    jest
      .spyOn(UserModel, 'findByIdAndUpdate')
      .mockResolvedValueOnce(updatedCurrentUser)
      .mockResolvedValueOnce({ ...mockTargetUser, followers: [] });

    const result = await toggleFollowUser(currentUser.username, targetUser.username);

    if (!('error' in result)) {
      expect(result.following).toHaveLength(0);
    }
  });

  it('should return error when trying to follow yourself', async () => {
    const result = await toggleFollowUser(currentUser.username, currentUser.username);

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('Cannot follow yourself');
    }
  });

  it('should return error when current user is not found', async () => {
    jest.spyOn(UserModel, 'findOne').mockResolvedValueOnce(null);

    const result = await toggleFollowUser(currentUser.username, targetUser.username);

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('User not found');
    }
  });

  it('should return error when target user is not found', async () => {
    jest
      .spyOn(UserModel, 'findOne')
      .mockResolvedValueOnce({ ...currentUser })
      .mockResolvedValueOnce(null);

    const result = await toggleFollowUser(currentUser.username, targetUser.username);

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('User not found');
    }
  });

  it('should return error when database error occurs', async () => {
    jest.spyOn(UserModel, 'findOne').mockRejectedValueOnce(new Error('Database error'));

    const result = await toggleFollowUser(currentUser.username, targetUser.username);

    expect('error' in result).toBe(true);
  });
});

describe('getFollowers', () => {
  const follower1: SafeDatabaseUser = {
    _id: new mongoose.Types.ObjectId(),
    username: 'follower1',
    dateJoined: new Date(),
    biography: 'Follower 1 bio',
    followers: [],
    following: [],
  };

  const follower2: SafeDatabaseUser = {
    _id: new mongoose.Types.ObjectId(),
    username: 'follower2',
    dateJoined: new Date(),
    biography: 'Follower 2 bio',
    followers: [],
    following: [],
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return list of followers for a user', async () => {
    const mockUser = {
      username: user.username,
      followers: [follower1, follower2],
    };

    jest.spyOn(UserModel, 'findOne').mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockUser),
    } as any);

    const result = await getFollowers(user.username);

    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result).toHaveLength(2);
      expect(result[0].username).toBe('follower1');
      expect(result[1].username).toBe('follower2');
    }
  });

  it('should return empty array when user has no followers', async () => {
    const mockUser = {
      username: user.username,
      followers: [],
    };

    jest.spyOn(UserModel, 'findOne').mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockUser),
    } as any);

    const result = await getFollowers(user.username);

    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result).toHaveLength(0);
    }
  });

  it('should return error when user is not found', async () => {
    jest.spyOn(UserModel, 'findOne').mockReturnValue({
      populate: jest.fn().mockResolvedValue(null),
    } as any);

    const result = await getFollowers(user.username);

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('User not found');
    }
  });

  it('should return error when database error occurs', async () => {
    jest.spyOn(UserModel, 'findOne').mockReturnValue({
      populate: jest.fn().mockRejectedValue(new Error('Database error')),
    } as any);

    const result = await getFollowers(user.username);

    expect('error' in result).toBe(true);
  });
});

describe('getFollowing', () => {
  const following1: SafeDatabaseUser = {
    _id: new mongoose.Types.ObjectId(),
    username: 'following1',
    dateJoined: new Date(),
    biography: 'Following 1 bio',
    followers: [],
    following: [],
  };

  const following2: SafeDatabaseUser = {
    _id: new mongoose.Types.ObjectId(),
    username: 'following2',
    dateJoined: new Date(),
    biography: 'Following 2 bio',
    followers: [],
    following: [],
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return list of users that a user is following', async () => {
    const mockUser = {
      username: user.username,
      following: [following1, following2],
    };

    jest.spyOn(UserModel, 'findOne').mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockUser),
    } as any);

    const result = await getFollowing(user.username);

    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result).toHaveLength(2);
      expect(result[0].username).toBe('following1');
      expect(result[1].username).toBe('following2');
    }
  });

  it('should return empty array when user is not following anyone', async () => {
    const mockUser = {
      username: user.username,
      following: [],
    };

    jest.spyOn(UserModel, 'findOne').mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockUser),
    } as any);

    const result = await getFollowing(user.username);

    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result).toHaveLength(0);
    }
  });

  it('should return error when user is not found', async () => {
    jest.spyOn(UserModel, 'findOne').mockReturnValue({
      populate: jest.fn().mockResolvedValue(null),
    } as any);

    const result = await getFollowing(user.username);

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('User not found');
    }
  });

  it('should return error when database error occurs', async () => {
    jest.spyOn(UserModel, 'findOne').mockReturnValue({
      populate: jest.fn().mockRejectedValue(new Error('Database error')),
    } as any);

    const result = await getFollowing(user.username);

    expect('error' in result).toBe(true);
  });
});
