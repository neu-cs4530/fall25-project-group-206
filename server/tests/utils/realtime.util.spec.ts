// tests/utils/realtime.spec.ts
import emitNotification, { registerSocketServer } from '../../utils/realtime';

describe('realtime socket utils', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing when socket server has not been registered', () => {
    // io is null by default; this should just early-return and not throw
    expect(() => emitNotification('user1')).not.toThrow();
  });

  it('emits notificationPing with username when socket server is registered', () => {
    const emit = jest.fn();
    const fakeSocket = { emit } as any;

    registerSocketServer(fakeSocket);

    emitNotification('user1');

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('notificationPing', { username: 'user1' });
  });
});
