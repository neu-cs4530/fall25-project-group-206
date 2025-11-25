// FILE: client/src/components/main/notificationsPage/NotificationPreferencesPanel.tsx
import { useEffect, useState, useCallback } from 'react';
import useNotificationPreferencesPage from '../../../hooks/useNotificationPreferencesPage';
import type {
  NotificationPriority,
  NotificationPreferencesDTO,
  NotificationLocation,
} from '../../../types/types';

interface Props {
  onClose: () => void;
}

/**
 * Local helper types for the grid keys.
 * These mirror the keys we use for category/location.
 */
type NotificationCategoryKey = 'question' | 'answer' | 'follow' | 'direct';
type NotificationLocationKey = Extract<
  NotificationLocation,
  'collection' | 'community' | 'following' | 'direct'
>;

/**
 * Normalize undefined priority to 'normal' for display/fallback.
 */
const getEffectivePriority = (priority?: NotificationPriority): NotificationPriority =>
  priority ?? 'normal';

/**
 * NotificationPreferencesPanel component allows users to view and modify their notification preferences.
 * @param param0 Props object
 * @returns JSX element representing the notification preferences panel
 */
const NotificationPreferencesPanel = ({ onClose }: Props) => {
  const {
    prefs,
    friends,
    bookmarkedCommunities,
    bookmarkedCollections,
    loading,
    saving,
    error,
    refetch,
    save,
  } = useNotificationPreferencesPage();

  const [localPrefs, setLocalPrefs] = useState<NotificationPreferencesDTO | null>(null);

  // Static metadata for the priority grid
  const priorityOptions: NotificationPriority[] = ['high', 'normal', 'low'];

  const categories: { key: NotificationCategoryKey; label: string }[] = [
    { key: 'question', label: 'Questions' },
    { key: 'answer', label: 'Answers' },
    { key: 'follow', label: 'Follows' },
    { key: 'direct', label: 'Direct / Chat' },
  ];

  const locations: { key: NotificationLocationKey; label: string }[] = [
    { key: 'collection', label: 'Collections' },
    { key: 'community', label: 'Communities' },
    { key: 'following', label: 'Following' },
    { key: 'direct', label: 'Direct' },
  ];

  /**
   * Matrix of which category/location pairs can actually occur.
   *
   * - Questions / Answers: can appear from collections, communities, following
   * - Follows: only makes sense in "Following"
   * - Direct / Chat: only makes sense in "Direct"
   */
  const allowedMatrix: Record<NotificationCategoryKey, NotificationLocationKey[]> = {
    question: ['collection', 'community', 'following'],
    answer: ['collection', 'community', 'following'],
    follow: ['following'],
    direct: ['direct'],
  };

  // Ensure we always have sensible defaults for the new fields
  useEffect(() => {
    if (!prefs) {
      setLocalPrefs(null);
      return;
    }
    setLocalPrefs({
      ...prefs,
      dndEnabled: prefs.dndEnabled ?? false,
      silentHours: prefs.silentHours ?? null,
      muteHighGroups: prefs.muteHighGroups ?? false,
      muteNormalGroups: prefs.muteNormalGroups ?? false,
      muteLowGroups: prefs.muteLowGroups ?? false,
    });
  }, [prefs]);

  const handleSave = useCallback(async () => {
    if (!localPrefs) {
      return;
    }
    await save(localPrefs);
  }, [localPrefs, save]);

  // Muting toggles operate purely on local state; user must click Save.
  const toggleMutedUser = (username: string) => {
    setLocalPrefs(prev => {
      if (!prev) {
        return prev;
      }
      const isMuted = prev.mutedUsers.includes(username);
      return {
        ...prev,
        mutedUsers: isMuted
          ? prev.mutedUsers.filter(u => u !== username)
          : [...prev.mutedUsers, username],
      };
    });
  };

  const toggleMutedCommunity = (communityId: string) => {
    setLocalPrefs(prev => {
      if (!prev) {
        return prev;
      }
      const isMuted = prev.mutedCommunities.includes(communityId);
      return {
        ...prev,
        mutedCommunities: isMuted
          ? prev.mutedCommunities.filter(id => id !== communityId)
          : [...prev.mutedCommunities, communityId],
      };
    });
  };

  const toggleMutedCollection = (collectionId: string) => {
    setLocalPrefs(prev => {
      if (!prev) {
        return prev;
      }
      const isMuted = prev.mutedCollections.includes(collectionId);
      return {
        ...prev,
        mutedCollections: isMuted
          ? prev.mutedCollections.filter(id => id !== collectionId)
          : [...prev.mutedCollections, collectionId],
      };
    });
  };

  /**
   * Priority change handler.
   *
   * When `scope === 'default'`, treat the new default as a *baseline*:
   *  - update `defaultPriority`
   *  - set *all* category/location cells to that value
   *  - clear per-category and per-location overrides
   */
  const handlePriorityChange = (
    scope: 'categoryLocation' | 'category' | 'location' | 'default',
    key: string,
    value: NotificationPriority,
  ) => {
    setLocalPrefs(prev => {
      if (!prev) {
        return prev;
      }

      if (scope === 'default') {
        const nextPerCategoryLocation: Record<string, NotificationPriority> = {};

        categories.forEach(cat => {
          locations.forEach(loc => {
            const pairKey = `${cat.key}:${loc.key}`;
            nextPerCategoryLocation[pairKey] = value;
          });
        });

        return {
          ...prev,
          defaultPriority: value,
          perCategoryLocation: nextPerCategoryLocation,
          perCategory: {},
          perLocation: {},
        };
      }

      if (scope === 'categoryLocation') {
        return {
          ...prev,
          perCategoryLocation: {
            ...prev.perCategoryLocation,
            [key]: value,
          },
        };
      }

      if (scope === 'category') {
        return {
          ...prev,
          perCategory: {
            ...prev.perCategory,
            [key]: value,
          },
        };
      }

      // scope === 'location'
      return {
        ...prev,
        perLocation: {
          ...prev.perLocation,
          [key]: value,
        },
      };
    });
  };

  /**
   * DND / Silent-hours handlers
   */
  const toggleDnd = () => {
    setLocalPrefs(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        dndEnabled: !(prev.dndEnabled ?? false),
      };
    });
  };

  if (loading || !localPrefs) {
    return (
      <div className='notifications-page'>
        <div className='notifications-header'>
          <h2>Notification Preferences</h2>
          <button type='button' onClick={onClose}>
            Back to Feed
          </button>
        </div>
        <p>Loading preferences...</p>
      </div>
    );
  }

  const handleSilentHoursChange = (field: 'start' | 'end', value: string) => {
    setLocalPrefs(prev => {
      if (!prev) return prev;

      const existing = prev.silentHours ?? { start: '', end: '' };
      const next = {
        ...existing,
        [field]: value,
      };

      // If both empty, treat as "no silent hours"
      if (!next.start && !next.end) {
        return {
          ...prev,
          silentHours: null,
        };
      }

      return {
        ...prev,
        silentHours: next,
      };
    });
  };

  const clearSilentHours = () => {
    setLocalPrefs(prev => (prev ? { ...prev, silentHours: null } : prev));
  };

  // For robustness: muted items that are no longer in the friend/bookmark lists.
  const extraMutedUsers = localPrefs.mutedUsers.filter(
    username => !friends.some(friend => friend.username === username),
  );
  const extraMutedCommunities = localPrefs.mutedCommunities.filter(
    id => !bookmarkedCommunities.some(comm => comm.id === id),
  );
  const extraMutedCollections = localPrefs.mutedCollections.filter(
    id => !bookmarkedCollections.some(coll => coll.id === id),
  );

  const dndEnabled = localPrefs.dndEnabled ?? false;
  const silent = localPrefs.silentHours ?? null;

  return (
    <div className='notifications-page'>
      <div className='notifications-header'>
        <h2>Notification Preferences</h2>
        <div className='notifications-header-buttons'>
          <button type='button' onClick={refetch}>
            Reload
          </button>
          <button type='button' onClick={onClose}>
            Back to Feed
          </button>
        </div>
      </div>

      {error && (
        <div className='notifications-error'>
          <span>{error}</span>
        </div>
      )}

      {/* Global Do Not Disturb + silent hours */}
      <section className='notifications-section'>
        <h3>Do Not Disturb</h3>
        <p>
          Enable Do Not Disturb to mute all notifications. You can also configure daily silent hours
          if you only want notifications outside a specific time range.
        </p>

        <label className='notif-pref-row'>
          <input type='checkbox' checked={dndEnabled} onChange={toggleDnd} /> Enable Do Not Disturb
          (mute all notifications)
        </label>

        <div className='notifications-dnd-hours'>
          <h4>Silent hours (optional)</h4>
          <p>
            Choose a daily time window when notifications should be silenced. Leave both times empty
            to disable silent hours. Overnight windows (for example, 22:00–07:00) are supported.
          </p>
          <div className='notifications-dnd-hours-inputs'>
            <span>From</span>
            <input
              type='time'
              value={silent?.start ?? ''}
              onChange={e => handleSilentHoursChange('start', e.target.value)}
              disabled={dndEnabled}
            />
            <span>to</span>
            <input
              type='time'
              value={silent?.end ?? ''}
              onChange={e => handleSilentHoursChange('end', e.target.value)}
              disabled={dndEnabled}
            />
            <button type='button' onClick={clearSilentHours} disabled={dndEnabled}>
              Clear
            </button>
          </div>
        </div>
      </section>

      {/* Muted users based on following list */}
      <section className='notifications-section'>
        <h3>Muted users</h3>
        <p>
          You will not receive notifications from these users (questions, answers, or direct
          messages).
        </p>

        {friends.length === 0 && extraMutedUsers.length === 0 ? (
          <p>No available users to mute. Follow people to see them here.</p>
        ) : (
          <div className='notif-pref-scroll'>
            <ul className='notif-pref-list'>
              {friends.map(friend => {
                const isMuted = localPrefs.mutedUsers.includes(friend.username);
                return (
                  <li key={friend.username} className='notif-pref-row'>
                    <label>
                      <input
                        type='checkbox'
                        checked={isMuted}
                        onChange={() => toggleMutedUser(friend.username)}
                      />{' '}
                      {friend.username}
                    </label>
                    <span className='notif-pref-row-status'>{isMuted ? 'Muted' : 'Allowed'}</span>
                  </li>
                );
              })}

              {extraMutedUsers.length > 0 && (
                <>
                  <li className='notif-pref-row-heading'>Other muted usernames</li>
                  {extraMutedUsers.map(username => (
                    <li key={username} className='notif-pref-row'>
                      <label>
                        <input type='checkbox' checked onChange={() => toggleMutedUser(username)} />{' '}
                        {username} (no longer in your following list)
                      </label>
                      <span className='notif-pref-row-status'>Muted</span>
                    </li>
                  ))}
                </>
              )}
            </ul>
          </div>
        )}
      </section>

      {/* Muted communities from bookmarked communities */}
      <section className='notifications-section'>
        <h3>Muted communities</h3>
        <p>You will not receive notifications for questions or answers inside these communities.</p>

        {bookmarkedCommunities.length === 0 && extraMutedCommunities.length === 0 ? (
          <p>You have not bookmarked any communities yet.</p>
        ) : (
          <div className='notif-pref-scroll'>
            <ul className='notif-pref-list'>
              {bookmarkedCommunities.map(comm => {
                const isMuted = localPrefs.mutedCommunities.includes(comm.id);
                return (
                  <li key={comm.id} className='notif-pref-row'>
                    <label>
                      <input
                        type='checkbox'
                        checked={isMuted}
                        onChange={() => toggleMutedCommunity(comm.id)}
                      />{' '}
                      {comm.name}
                    </label>
                    <span className='notif-pref-row-status'>{isMuted ? 'Muted' : 'Allowed'}</span>
                  </li>
                );
              })}

              {extraMutedCommunities.length > 0 && (
                <>
                  <li className='notif-pref-row-heading'>Other muted community IDs</li>
                  {extraMutedCommunities.map(id => (
                    <li key={id} className='notif-pref-row'>
                      <label>
                        <input type='checkbox' checked onChange={() => toggleMutedCommunity(id)} />{' '}
                        {id} (not in your bookmarked communities)
                      </label>
                      <span className='notif-pref-row-status'>Muted</span>
                    </li>
                  ))}
                </>
              )}
            </ul>
          </div>
        )}
      </section>

      {/* Muted collections from bookmarked collections */}
      <section className='notifications-section'>
        <h3>Muted collections</h3>
        <p>You will not receive notifications for questions in these collections.</p>

        {bookmarkedCollections.length === 0 && extraMutedCollections.length === 0 ? (
          <p>You have not bookmarked any collections yet.</p>
        ) : (
          <div className='notif-pref-scroll'>
            <ul className='notif-pref-list'>
              {bookmarkedCollections.map(coll => {
                const isMuted = localPrefs.mutedCollections.includes(coll.id);
                return (
                  <li key={coll.id} className='notif-pref-row'>
                    <label>
                      <input
                        type='checkbox'
                        checked={isMuted}
                        onChange={() => toggleMutedCollection(coll.id)}
                      />{' '}
                      {coll.name}
                    </label>
                    <span className='notif-pref-row-status'>{isMuted ? 'Muted' : 'Allowed'}</span>
                  </li>
                );
              })}

              {extraMutedCollections.length > 0 && (
                <>
                  <li className='notif-pref-row-heading'>Other muted collection IDs</li>
                  {extraMutedCollections.map(id => (
                    <li key={id} className='notif-pref-row'>
                      <label>
                        <input type='checkbox' checked onChange={() => toggleMutedCollection(id)} />{' '}
                        {id} (not in your bookmarked collections)
                      </label>
                      <span className='notif-pref-row-status'>Muted</span>
                    </li>
                  ))}
                </>
              )}
            </ul>
          </div>
        )}
      </section>

      <section className='notifications-section notifications-priority-section'>
        <h3>Priority levels</h3>
        <p>
          Set how prominently different types of notifications should appear. Changing the default
          will update all rows below; you can then override individual cells.
        </p>

        <div className='notifications-priority-mute-tiers'>
          <label>
            <input
              type='checkbox'
              checked={localPrefs.muteHighGroups ?? false}
              onChange={e =>
                setLocalPrefs(prev => (prev ? { ...prev, muteHighGroups: e.target.checked } : prev))
              }
            />{' '}
            Hide high-priority notifications from the feed
          </label>
          <label>
            <input
              type='checkbox'
              checked={localPrefs.muteNormalGroups ?? false}
              onChange={e =>
                setLocalPrefs(prev =>
                  prev ? { ...prev, muteNormalGroups: e.target.checked } : prev,
                )
              }
            />{' '}
            Hide normal-priority notifications from the feed
          </label>
          <label>
            <input
              type='checkbox'
              checked={localPrefs.muteLowGroups ?? false}
              onChange={e =>
                setLocalPrefs(prev => (prev ? { ...prev, muteLowGroups: e.target.checked } : prev))
              }
            />{' '}
            Hide low-priority notifications from the feed
          </label>
        </div>

        <div className='notifications-priority-default'>
          <span className='notifications-priority-label'>
            Default priority for all notifications
          </span>
          <select
            value={localPrefs.defaultPriority}
            onChange={e =>
              handlePriorityChange('default', '', e.target.value as NotificationPriority)
            }>
            {priorityOptions.map(opt => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className='notifications-priority-grid'>
          <div className='notifications-priority-grid-header'>
            <span>Fine-tune by category and location</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Category \\ Location</th>
                {locations.map(loc => (
                  <th key={loc.key}>{loc.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => (
                <tr key={cat.key}>
                  <td>{cat.label}</td>
                  {locations.map(loc => {
                    const pairKey = `${cat.key}:${loc.key}`;
                    const isAllowed = allowedMatrix[cat.key].includes(loc.key);

                    if (!isAllowed) {
                      // Impossible combination → gray, non-interactive cell
                      return (
                        <td
                          key={pairKey}
                          className='notifications-priority-cell notifications-priority-cell--disabled'>
                          <span className='notifications-priority-na'>—</span>
                        </td>
                      );
                    }

                    const current = getEffectivePriority(
                      localPrefs.perCategoryLocation[pairKey] ??
                        localPrefs.perCategory[cat.key] ??
                        localPrefs.perLocation[loc.key] ??
                        localPrefs.defaultPriority,
                    );

                    return (
                      <td key={pairKey} className='notifications-priority-cell'>
                        <select
                          value={current}
                          onChange={e =>
                            handlePriorityChange(
                              'categoryLocation',
                              pairKey,
                              e.target.value as NotificationPriority,
                            )
                          }>
                          {priorityOptions.map(opt => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className='notifications-actions'>
        <button type='button' className='notifications-save' disabled={saving} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save preferences'}
        </button>
      </div>
    </div>
  );
};

export default NotificationPreferencesPanel;
