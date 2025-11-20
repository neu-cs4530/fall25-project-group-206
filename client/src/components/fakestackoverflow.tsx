import { JSX, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Layout from './layout';
import Login from './auth/login';
import Signup from './auth/signup';
import OAuthSuccess from './auth/oauth';

import { FakeSOSocket, SafeDatabaseUser } from '../types/types';

import LoginContext from '../contexts/LoginContext';
import UserContext from '../contexts/UserContext';

import QuestionPage from './main/questionPage';
import TagPage from './main/tagPage';
import NewQuestionPage from './main/newQuestion';
import NewAnswerPage from './main/newAnswer';
import AnswerPage from './main/answerPage';
import MessagingPage from './main/messagingPage';
import DirectMessage from './main/directMessage';
import UsersListPage from './main/usersListPage';
import ProfileSettings from './profileSettings';
import AllGamesPage from './main/games/allGamesPage';
import GamePage from './main/games/gamePage';
import AllCommunitiesPage from './main/communities/allCommunitiesPage';
import NewCommunityPage from './main/communities/newCommunityPage';
import CommunityPage from './main/communities/communityPage';
import AllCollectionsPage from './main/collections/allCollectionsPage';
import CollectionPage from './main/collections/collectionPage';
import NewCollectionPage from './main/collections/newCollectionPage';
import BookmarksPage from './main/bookmarks';
import NotificationsPage from './main/notificationsPage';

import NotificationSocketBridge from './NotificationSocketBridge';
import NotificationToaster from './main/notificationToaster';

/**
 * ProtectedRoute component ensures that only authenticated users can access certain routes.
 */
const ProtectedRoute = ({
  user,
  socket,
  children,
}: {
  user: SafeDatabaseUser | null;
  socket: FakeSOSocket | null;
  children: JSX.Element;
}) => {
  if (!user || !socket) {
    return <Navigate to='/' />;
  }

  return <UserContext.Provider value={{ user, socket }}>{children}</UserContext.Provider>;
};

/**
 * Represents the main component of the application.
 * It manages the user state and route configuration.
 */
const FakeStackOverflow = ({ socket }: { socket: FakeSOSocket | null }) => {
  const [user, setUser] = useState<SafeDatabaseUser | null>(null);

  return (
    <LoginContext.Provider value={{ setUser }}>
      <Routes>
        {/* Public Routes */}
        <Route path='/' element={<Login />} />
        <Route path='/signup' element={<Signup />} />
        <Route path='/oauth-success' element={<OAuthSuccess />} />

        {/* Protected Routes */}
        <Route
          element={
            <ProtectedRoute user={user} socket={socket}>
              <>
                {/* Listen for notification pings for the logged-in user */}
                <NotificationSocketBridge />

                {/* Main layout for the app */}
                <Layout />

                {/* Global top-center toast */}
                <NotificationToaster />
              </>
            </ProtectedRoute>
          }>
          <Route path='/home' element={<QuestionPage />} />
          <Route path='/tags' element={<TagPage />} />
          <Route path='/messaging' element={<MessagingPage />} />
          <Route path='/messaging/direct-message' element={<DirectMessage />} />
          <Route path='/question/:qid' element={<AnswerPage />} />
          <Route path='/new/question' element={<NewQuestionPage />} />
          <Route path='/new/answer/:qid' element={<NewAnswerPage />} />
          <Route path='/users' element={<UsersListPage />} />
          <Route path='/user/:username' element={<ProfileSettings />} />
          <Route path='/new/collection' element={<NewCollectionPage />} />
          <Route path='/collections/:username' element={<AllCollectionsPage />} />
          <Route path='/collections/:username/:collectionId' element={<CollectionPage />} />
          <Route path='/games' element={<AllGamesPage />} />
          <Route path='/games/:gameID' element={<GamePage />} />
          <Route path='/communities' element={<AllCommunitiesPage />} />
          <Route path='/new/community' element={<NewCommunityPage />} />
          <Route path='/communities/:communityID' element={<CommunityPage />} />
          <Route path='/bookmarks/:username' element={<BookmarksPage />} />
          <Route path='/notifications' element={<NotificationsPage />} />
        </Route>
      </Routes>
    </LoginContext.Provider>
  );
};

export default FakeStackOverflow;
