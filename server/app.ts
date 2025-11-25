// The server should run on localhost port 8000.
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import * as http from 'http';
import * as OpenApiValidator from 'express-openapi-validator';
import swaggerUi from 'swagger-ui-express';
import yaml from 'yaml';
import * as fs from 'fs';

import answerController from './controllers/answer.controller';
import questionController from './controllers/question.controller';
import tagController from './controllers/tag.controller';
import commentController from './controllers/comment.controller';
import { FakeSOSocket } from './types/types';
import userController from './controllers/user.controller';
import messageController from './controllers/message.controller';
import chatController from './controllers/chat.controller';
import gameController from './controllers/game.controller';
import collectionController from './controllers/collection.controller';
import communityController from './controllers/community.controller';
import bookmarkController from './controllers/bookmark.controller';
import notificationController from './controllers/notification.controller';
import authController from './controllers/auth.controller';
import { registerSocketServer } from './utils/realtime';
import passport from 'passport';
import session from 'express-session';

const MONGO_URL = `${process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'}/fake_so`;
const PORT = parseInt(process.env.PORT || '8000');

const app = express();
const server = http.createServer(app);

// allow requests from the local dev client or the production client only
const socket: FakeSOSocket = new Server(server, {
  path: '/socket.io',
  cors: {
    origin: `${process.env.CLIENT_URL}` || 'http://localhost:4530',
    credentials: true,
  },
});

registerSocketServer(socket);

function connectDatabase() {
  return mongoose.connect(MONGO_URL).catch(() => {
    // do nothing
  });
}

function startServer() {
  connectDatabase();
  server.listen(PORT, () => {
    // do nothing
  });
}

socket.on('connection', socket => {
  // do nothing

  socket.on('disconnect', () => {
    // do nothing
  });
});

process.on('SIGINT', async () => {
  await mongoose.disconnect();
  socket.close();

  server.close(() => {
    // do nothing
    process.exit(0);
  });
});

app.use(express.json());

try {
  app.use(
    OpenApiValidator.middleware({
      apiSpec: './openapi.yaml',
      validateRequests: true,
      validateResponses: true,
      ignoreUndocumented: true,
      ignorePaths: (req: { path: string }) =>
        req.path === '/api/auth/google' ||
        req.path === '/api/auth/google/callback' ||
        req.path === '/query/scope',
      formats: {
        'object-id': (v: string) => /^[0-9a-fA-F]{24}$/.test(v),
      },
    }),
  );

  // Custom Error Handler for express-openapi-validator errors
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err.status && err.errors) {
      res.status(err.status).json({
        message: 'Request Validation Failed',
        errors: err.errors,
      });
    } else {
      next(err);
    }
  });
} catch (e) {
  // do nothing
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'supersecret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: 'lax',
    },
  }),
);

// Register all controllers
app.use('/api/question', questionController(socket));
app.use('/api/tags', tagController());
app.use('/api/answer', answerController(socket));
app.use('/api/comment', commentController(socket));
app.use('/api/message', messageController(socket));
app.use('/api/user', userController(socket));
app.use('/api/chat', chatController(socket));
app.use('/api/games', gameController(socket));
app.use('/api/collection', collectionController(socket));
app.use('/api/community', communityController(socket));
app.use('/api/bookmark', bookmarkController(socket));
app.use('/api/notification', notificationController(socket));

app.use(passport.initialize());
app.use(passport.session());
app.use('/api/auth', authController());

const openApiDocument = yaml.parse(fs.readFileSync('./openapi.yaml', 'utf8'));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

export { app, server, startServer };
