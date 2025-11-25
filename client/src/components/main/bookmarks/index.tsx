// client/src/components/main/bookmarks/index.tsx
import './index.css';
import { useEffect, useState } from 'react';
import useBookmarksPage from '../../../hooks/useBookmarksPage';
import { useNavigate } from 'react-router-dom';
import useUserContext from '../../../hooks/useUserContext';
import BookmarkButton from '../bookmarkButton';
import { PopulatedDatabaseBookmark } from '@fake-stack-overflow/shared';

/**
 * BookmarksPage component displays all bookmarks for the logged-in user.
 * @returns A JSX element representing the bookmarks page.
 */
const BookmarksPage = () => {
  const { user } = useUserContext();
  const { collections, communities, users, loading } = useBookmarksPage();
  const navigate = useNavigate();

  // Local state so we can remove cards when unbookmarked
  const [collectionBookmarks, setCollectionBookmarks] =
    useState<PopulatedDatabaseBookmark[]>(collections);
  const [communityBookmarks, setCommunityBookmarks] =
    useState<PopulatedDatabaseBookmark[]>(communities);

  // Keep in sync when the hook refetches
  useEffect(() => {
    setCollectionBookmarks(collections);
  }, [collections]);

  useEffect(() => {
    setCommunityBookmarks(communities);
  }, [communities]);

  if (loading) {
    return <div className='bookmarks-page'>Loading bookmarks...</div>;
  }

  const handleCollectionClick = (collectionId: string, owner: string) => {
    navigate(`/collections/${owner}/${collectionId}`);
  };

  const handleCommunityClick = (communityId: string) => {
    navigate(`/communities/${communityId}`);
  };

  return (
    <div className='bookmarks-page'>
      <div className='bookmarks-header'>
        <h1 className='bookmarks-title'>{user.username}&apos;s Bookmarks</h1>
      </div>

      {/* COLLECTIONS SECTION */}
      {collectionBookmarks.length > 0 && (
        <>
          <h2 className='bookmark-section-title'>Collections</h2>
          <div className='bookmarks-list'>
            {collectionBookmarks.map(bookmark => {
              const c = bookmark.populatedTarget as {
                _id?: string;
                username?: string;
                name?: string;
                description?: string;
                isPrivate?: boolean;
                questions?: unknown[];
              } | null;

              if (!c?._id) return null;

              return (
                <div
                  key={c._id}
                  className='bookmark-card'
                  onClick={() => handleCollectionClick(c._id!, c.username ?? '')}>
                  <div className='bookmark-card-header'>
                    <h3 className='bookmark-name'>{c.name ?? 'Unnamed Collection'}</h3>
                    <BookmarkButton
                      targetId={c._id.toString()}
                      targetType='Collection'
                      confirmOnRemove
                      confirmMessage='Remove this collection from your bookmarks?'
                      onToggleComplete={result => {
                        if (result === 'removed') {
                          setCollectionBookmarks(prev =>
                            prev.filter(
                              b => b.targetId.toString() !== bookmark.targetId.toString(),
                            ),
                          );
                        }
                      }}
                    />
                  </div>

                  <p className='bookmark-description'>{c.description ?? ''}</p>
                  <p className='bookmark-meta'>
                    {c.isPrivate ? 'Private' : 'Public'} • {c.questions?.length ?? 0} Questions
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* COMMUNITIES SECTION */}
      {communityBookmarks.length > 0 && (
        <>
          <h2 className='bookmark-section-title'>Communities</h2>
          <div className='bookmarks-list'>
            {communityBookmarks.map(bookmark => {
              const comm = bookmark.populatedTarget as {
                _id?: string;
                name?: string;
                description?: string;
                visibility?: string;
                participants?: unknown[];
              } | null;

              if (!comm?._id) return null;

              return (
                <div
                  key={comm._id}
                  className='bookmark-card'
                  onClick={() => handleCommunityClick(comm._id!)}>
                  <div className='bookmark-card-header'>
                    <h3 className='bookmark-name'>{comm.name ?? 'Unnamed Community'}</h3>
                    <BookmarkButton
                      targetId={comm._id.toString()}
                      targetType='Community'
                      confirmOnRemove
                      confirmMessage='Remove this community from your bookmarks?'
                      onToggleComplete={result => {
                        if (result === 'removed') {
                          setCommunityBookmarks(prev =>
                            prev.filter(
                              b => b.targetId.toString() !== bookmark.targetId.toString(),
                            ),
                          );
                        }
                      }}
                    />
                  </div>

                  <p className='bookmark-description'>{comm.description ?? ''}</p>
                  <p className='bookmark-meta'>
                    {comm.visibility ?? 'Unknown'} • {comm.participants?.length ?? 0} participants
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* FALLBACK */}
      {collectionBookmarks.length === 0 &&
        communityBookmarks.length === 0 &&
        users.length === 0 && <p className='no-bookmarks'>No bookmarks yet.</p>}
    </div>
  );
};

export default BookmarksPage;
