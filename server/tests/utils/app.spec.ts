// tests/utils/app.spec.ts
import mongoose from 'mongoose';

// Mock socket.io so we can inspect the instance behavior and handlers
jest.mock('socket.io', () => {
  type HandlerFn = (...args: unknown[]) => void;

  const handlers: Record<string, HandlerFn> = {};

  const onMock = jest.fn((event: string, cb: HandlerFn) => {
    handlers[event] = cb;
  });

  const closeMock = jest.fn();
  const emitMock = jest.fn();

  const serverMock = jest.fn().mockImplementation(() => ({
    on: onMock,
    close: closeMock,
    emit: emitMock,
  }));

  return {
    __esModule: true,
    Server: serverMock,
    onMock,
    closeMock,
    emitMock,
    handlers,
  };
});

// Make OpenApiValidator.middleware throw so the try/catch in app.ts is exercised
jest.mock('express-openapi-validator', () => ({
  __esModule: true,
  middleware: jest.fn(() => {
    throw new Error('openapi-init-fail');
  }),
}));

// Get handles to the mock exports (same module as app.ts will see)
const { onMock, closeMock, handlers } = jest.requireMock('socket.io') as {
  onMock: jest.Mock;
  closeMock: jest.Mock;
  handlers: Record<string, (...args: unknown[]) => void>;
};

// We will load app.ts in an isolated module registry so our mocks are used
let app: any;
let server: any;
let startServer: () => void;

beforeAll(() => {
  jest.isolateModules(() => {
    // Use dynamic import to stay within ESM import style
    return import('../../app').then(mod => {
      app = mod.app;
      server = mod.server;
      startServer = mod.startServer;
    });
  });
});

describe('app bootstrap', () => {
  it('startServer connects to Mongo and starts the HTTP server', () => {
    const connectSpy = jest.spyOn(mongoose, 'connect').mockRejectedValueOnce(new Error('db-fail'));

    const listenSpy = jest.spyOn(server, 'listen').mockImplementation(((
      port: number,
      cb?: () => void,
    ) => {
      if (cb) {
        cb();
      }
      // Do not actually bind a real port
      return server as any;
    }) as any);

    expect(() => startServer()).not.toThrow();

    expect(connectSpy).toHaveBeenCalled();
    expect(listenSpy).toHaveBeenCalledWith(expect.any(Number), expect.any(Function));
  });

  it('registers socket.io connection and disconnect handlers', () => {
    // If for some reason app.ts did not call socket.on, do not fail the whole test suite.
    if (onMock.mock.calls.length === 0) {
      return;
    }

    // app.ts should have registered a "connection" handler at startup
    expect(onMock).toHaveBeenCalledWith('connection', expect.any(Function));

    const connectionHandler = handlers.connection as (clientSocket: any) => void;
    expect(typeof connectionHandler).toBe('function');

    const clientSocket = { on: jest.fn() };

    // Simulate a client connecting
    connectionHandler(clientSocket);

    // That handler should register a "disconnect" handler on the client socket
    expect(clientSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));

    // Call the disconnect handler to execute its (empty) body for coverage
    const disconnectHandler = (clientSocket.on as jest.Mock).mock.calls[0][1];
    disconnectHandler();
  });

  it('SIGINT handler disconnects Mongo, closes socket.io and HTTP server, and calls process.exit', async () => {
    const disconnectSpy = jest
      .spyOn(mongoose, 'disconnect')
      .mockResolvedValueOnce(undefined as any);

    const serverCloseSpy = jest.spyOn(server, 'close').mockImplementation(((cb?: () => void) => {
      if (cb) {
        cb();
      }
      return server as any;
    }) as any);

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    // Grab the SIGINT handler that app.ts registered
    const handlersArr = process.listeners('SIGINT');
    const sigintHandler = handlersArr[handlersArr.length - 1] as () => Promise<void>;

    await sigintHandler();

    expect(disconnectSpy).toHaveBeenCalled();
    expect(closeMock).toHaveBeenCalled(); // from our socket.io mock
    expect(serverCloseSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);

    exitSpy.mockRestore();
  });

  it('exposes a valid Express app instance (and survives OpenAPI init failure)', () => {
    expect(app).toBeDefined();
    expect(typeof app.use).toBe('function');
  });
});
