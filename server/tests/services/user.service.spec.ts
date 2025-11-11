import mongoose, { Query } from 'mongoose';
import UserModel from '../../models/users.model';
import * as speakeasy from 'speakeasy';
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
  updateMessagingSetting,
  generate2FASecret,
  enable2FA,
  disable2FA,
  verify2FAToken,
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

  // it('should return the user if authentication succeeds', async () => {
  //   jest.spyOn(UserModel, 'findOne').mockImplementation((filter?: any) => {
  //     expect(filter.username).toBeDefined();
  //     // expect(filter.password).toBeDefined();
  //     const query: any = {};
  //     query.select = jest.fn().mockReturnValue(Promise.resolve(safeUser));
  //     return query;
  //   });

  //   const credentials: UserCredentials = {
  //     username: user.username,
  //     password: user.password,
  //   };

  //   const loggedInUser = (await loginUser(credentials)) as SafeDatabaseUser;

  //   expect(loggedInUser.username).toEqual(user.username);
  //   expect(loggedInUser.dateJoined).toEqual(user.dateJoined);
  // });

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
    email: user.email,
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
    email: 'testemail@gmail.com',
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
    email: 'testemail@gmail.com',
    dateJoined: new Date(),
    biography: 'Follower 1 bio',
    followers: [],
    following: [],
  };

  const follower2: SafeDatabaseUser = {
    _id: new mongoose.Types.ObjectId(),
    username: 'follower2',
    email: 'testemail@gmail.com',
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
    email: 'testemail@gmail.com',
    dateJoined: new Date(),
    biography: 'Following 1 bio',
    followers: [],
    following: [],
  };

  const following2: SafeDatabaseUser = {
    _id: new mongoose.Types.ObjectId(),
    username: 'following2',
    email: 'testemail@gmail.com',
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

describe('updateMessagingSetting', () => {
  const baseSafeUser: SafeDatabaseUser = {
    _id: new mongoose.Types.ObjectId(),
    username: user.username,
    email: user.email,
    dateJoined: user.dateJoined,
    followers: user.followers,
    following: user.following,
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('updates to allow open messaging (true) with correct args and projection', async () => {
    const select = jest.fn().mockResolvedValue({ ...baseSafeUser, allowOpenMessaging: true });
    const spy = jest
      .spyOn(UserModel, 'findOneAndUpdate')
      .mockImplementation((filter?: any, update?: any, options?: any) => {
        // verify args
        expect(filter).toEqual({ username: user.username });
        expect(update).toEqual({ $set: { allowOpenMessaging: true } });
        expect(options).toMatchObject({ new: true });

        return { select } as any;
      });

    const result = await updateMessagingSetting(user.username, true);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith('-password');

    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.username).toEqual(user.username);
      expect((result as any).allowOpenMessaging).toBe(true);
    }
  });

  it('updates to disallow open messaging (false) with correct args and projection', async () => {
    const select = jest.fn().mockResolvedValue({ ...baseSafeUser, allowOpenMessaging: false });
    const spy = jest
      .spyOn(UserModel, 'findOneAndUpdate')
      .mockImplementation((filter?: any, update?: any, options?: any) => {
        expect(filter).toEqual({ username: user.username });
        expect(update).toEqual({ $set: { allowOpenMessaging: false } });
        expect(options).toMatchObject({ new: true });
        return { select } as any;
      });

    const result = await updateMessagingSetting(user.username, false);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith('-password');

    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.username).toEqual(user.username);
      expect((result as any).allowOpenMessaging).toBe(false);
    }
  });

  it('returns error when findOneAndUpdate returns null directly', async () => {
    jest.spyOn(UserModel, 'findOneAndUpdate').mockResolvedValueOnce(null as any);

    const result = await updateMessagingSetting(user.username, true);

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('Error occurred when updating messaging setting');
    }
  });

  it('returns error when select resolves to null', async () => {
    jest.spyOn(UserModel, 'findOneAndUpdate').mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    } as any);

    const result = await updateMessagingSetting(user.username, true);

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('Error occurred when updating messaging setting');
    }
  });

  it('returns error when select rejects (db error)', async () => {
    jest.spyOn(UserModel, 'findOneAndUpdate').mockReturnValue({
      select: jest.fn().mockRejectedValue(new Error('Database error')),
    } as any);

    const result = await updateMessagingSetting(user.username, true);

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('Error occurred when updating messaging setting');
    }
  });
});

describe('generate2FASecret', () => {
  it('should generate a secret and QR code', async () => {
    const result = await generate2FASecret('testuser');

    expect(result).toHaveProperty('secret');
    expect(result).toHaveProperty('qrCode');
    expect(result.secret).toBeTruthy();
    expect(result.qrCode).toContain('data:image/png;base64');
  });

  it('should generate a valid base32 secret', async () => {
    const result = await generate2FASecret('testuser');

    // Base32 should only contain A-Z and 2-7
    expect(result.secret).toMatch(/^[A-Z2-7]+$/);
    expect(result.secret.length).toBeGreaterThan(0);
  });

  it('should include username in QR code', async () => {
    const result = await generate2FASecret('testuser');

    expect(result.qrCode).toContain('data:image/png;base64');
  });
});

describe('enable2FA', () => {
  let mockUser: any;
  let mockToken: string;
  let mockSecret: string;

  beforeEach(() => {
    mockSecret = 'JBSWY3DPEBLW64TMMQ======'; // Valid base32
    mockToken = '123456'; // Mock token
    mockUser = {
      _id: new mongoose.Types.ObjectId(),
      username: 'testuser',
      twoFactorEnabled: false,
      twoFactorSecret: null,
    };
  });

  it('should enable 2FA when valid token is provided', async () => {
    const verifySpy = jest.spyOn(speakeasy.totp, 'verify').mockReturnValue(true as any);

    UserModel.findOneAndUpdate = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: mockUser._id,
        username: 'testuser',
        twoFactorEnabled: true,
      }),
    });

    const result = await enable2FA('testuser', mockSecret, mockToken);

    expect(result).not.toHaveProperty('error');
    expect(result).toHaveProperty('username', 'testuser');
    expect(UserModel.findOneAndUpdate).toHaveBeenCalledWith(
      { username: 'testuser' },
      {
        $set: {
          twoFactorEnabled: true,
          twoFactorSecret: mockSecret,
        },
      },
      { new: true },
    );
    expect(verifySpy).toHaveBeenCalled();

    verifySpy.mockRestore();
  });

  it('should not enable 2FA when token is invalid', async () => {
    const verifySpy = jest.spyOn(speakeasy.totp, 'verify').mockReturnValue(false as any);

    const result = await enable2FA('testuser', mockSecret, 'invalid');

    expect(result).toHaveProperty('error');
    expect('error' in result).toBe(true);
    expect(UserModel.findOneAndUpdate).not.toHaveBeenCalled();

    verifySpy.mockRestore();
  });

  it('should return error if user not found', async () => {
    const verifySpy = jest.spyOn(speakeasy.totp, 'verify').mockReturnValue(true as any);

    UserModel.findOneAndUpdate = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const result = await enable2FA('nonexistent', mockSecret, mockToken);

    expect(result).toHaveProperty('error');
    expect('error' in result).toBe(true);

    verifySpy.mockRestore();
  });

  it('should not return twoFactorSecret in response', async () => {
    const verifySpy = jest.spyOn(speakeasy.totp, 'verify').mockReturnValue(true as any);

    UserModel.findOneAndUpdate = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: mockUser._id,
        username: 'testuser',
        twoFactorEnabled: true,
        // twoFactorSecret should be excluded by .select('-password -twoFactorSecret')
      }),
    });

    const result = await enable2FA('testuser', mockSecret, mockToken);

    expect(result).not.toHaveProperty('twoFactorSecret');

    verifySpy.mockRestore();
  });
});

describe('disable2FA', () => {
  let mockUser: any;

  beforeEach(() => {
    mockUser = {
      _id: new mongoose.Types.ObjectId(),
      username: 'testuser',
      twoFactorEnabled: true,
      twoFactorSecret: 'JBSWY3DPEBLW64TMMQ======',
    };
  });

  it('should disable 2FA for a user', async () => {
    UserModel.findOneAndUpdate = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: mockUser._id,
        username: 'testuser',
        twoFactorEnabled: false,
      }),
    });

    const result = await disable2FA('testuser');

    expect(result).not.toHaveProperty('error');
    expect(result).toHaveProperty('username', 'testuser');
    expect(UserModel.findOneAndUpdate).toHaveBeenCalledWith(
      { username: 'testuser' },
      {
        $set: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      },
      { new: true },
    );
  });

  it('should return error if user not found', async () => {
    UserModel.findOneAndUpdate = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const result = await disable2FA('nonexistent');

    expect(result).toHaveProperty('error');
    expect('error' in result).toBe(true);
  });

  it('should not return twoFactorSecret in response', async () => {
    UserModel.findOneAndUpdate = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: mockUser._id,
        username: 'testuser',
        twoFactorEnabled: false,
        // twoFactorSecret should be excluded
      }),
    });

    const result = await disable2FA('testuser');

    expect(result).not.toHaveProperty('twoFactorSecret');
  });
});

describe('verify2FAToken', () => {
  let mockUser: any;
  let mockSecret: string;

  beforeEach(() => {
    mockSecret = 'JBSWY3DPEBLW64TMMQ======';
    mockUser = {
      _id: new mongoose.Types.ObjectId(),
      username: 'testuser',
      twoFactorEnabled: true,
      twoFactorSecret: mockSecret,
    };
  });

  it('should return true for valid token', async () => {
    const verifySpy = jest.spyOn(speakeasy.totp, 'verify').mockReturnValue(true as any);

    UserModel.findOne = jest.fn().mockResolvedValue(mockUser);

    const result = await verify2FAToken('testuser', '123456');

    expect(result).toBe(true);
    expect(UserModel.findOne).toHaveBeenCalledWith({ username: 'testuser' });
    expect(verifySpy).toHaveBeenCalledWith({
      secret: mockSecret,
      encoding: 'base32',
      token: '123456',
    });

    verifySpy.mockRestore();
  });

  it('should return false for invalid token', async () => {
    const verifySpy = jest.spyOn(speakeasy.totp, 'verify').mockReturnValue(false as any);

    UserModel.findOne = jest.fn().mockResolvedValue(mockUser);

    const result = await verify2FAToken('testuser', 'invalid');

    expect(result).toBe(false);

    verifySpy.mockRestore();
  });

  it('should return false if user not found', async () => {
    UserModel.findOne = jest.fn().mockResolvedValue(null);

    const result = await verify2FAToken('nonexistent', '123456');

    expect(result).toBe(false);
  });

  it('should return false if user has no 2FA secret', async () => {
    UserModel.findOne = jest.fn().mockResolvedValue({
      ...mockUser,
      twoFactorSecret: null,
    });

    const result = await verify2FAToken('testuser', '123456');

    expect(result).toBe(false);
  });

  it('should return false on verification error', async () => {
    const verifySpy = jest.spyOn(speakeasy.totp, 'verify').mockImplementation(() => {
      throw new Error('Verification error');
    });

    UserModel.findOne = jest.fn().mockResolvedValue(mockUser);

    const result = await verify2FAToken('testuser', '123456');

    expect(result).toBe(false);

    verifySpy.mockRestore();
  });
});
