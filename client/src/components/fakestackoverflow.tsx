import { JSX, useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './layout';
import Login from './auth/login';
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
import Signup from './auth/signup';
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
import NotificationsPage from './main/notifications';

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
  console.log('[ProtectedRoute] Checking access:', {
    hasUser: !!user,
    hasSocket: !!socket,
    username: user?.username,
  });

  if (!user || !socket) {
    console.warn('[ProtectedRoute] ❌ Redirecting to / (no user or socket)');
    return <Navigate to='/' />;
  }

  console.log('[ProtectedRoute] ✅ Access granted for user:', user.username);
  return <UserContext.Provider value={{ user, socket }}>{children}</UserContext.Provider>;
};

/**
 * Represents the main component of the application.
 * It manages the user context for login and routing.
 */
const FakeStackOverflow = ({ initialSocket }: { initialSocket: FakeSOSocket | null }) => {
  const [user, setUser] = useState<SafeDatabaseUser | null>(null);
  const [socket, setSocket] = useState<FakeSOSocket | null>(initialSocket);

  // Log lifecycle
  useEffect(() => {
    console.log('[FakeSO] Mounted');
    return () => console.log('[FakeSO] Unmounted');
  }, []);

  // Log whenever the user changes
  useEffect(() => {
    console.log('[FakeSO] 🔄 user state changed:', user);
  }, [user]);

  // Log whenever socket changes
  useEffect(() => {
    console.log('[FakeSO] 🔌 socket prop changed:', socket);
  }, [socket]);

  const handleSetUser = (u: SafeDatabaseUser | null) => {
    console.log('[FakeSO] 🧠 setUser() called from LoginContext with:', u);
    setUser(u);
  };

  const handleSetSocket = (s: FakeSOSocket | null) => {
    console.log('[FakeSO] 🔌 setSocket() called from LoginContext with:', s);
    setSocket(s);
  };

  return (
    <LoginContext.Provider value={{ setUser: handleSetUser, setSocket: handleSetSocket }}>
      <Routes>
        {/* Public Routes */}
        <Route
          path='/'
          element={
            <>
              {console.log('[FakeSO] Rendering Login route')}
              <Login />
            </>
          }
        />
        <Route
          path='/signup'
          element={
            <>
              {console.log('[FakeSO] Rendering Signup route')}
              <Signup />
            </>
          }
        />

        {/* Protected Routes */}
        <Route
          element={
            <ProtectedRoute user={user} socket={socket}>
              <Layout />
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
