// FILE: server/models/notificationPreference.model.ts
import mongoose, { Model } from 'mongoose';
import notificationPreferencesSchema from './schema/notificationPreferences.schema';
import type { NotificationPriority } from '../types/types';

export interface NotificationPreferences {
  user: mongoose.Types.ObjectId;
  mutedUsers: string[];
  mutedCommunities: mongoose.Types.ObjectId[];
  mutedCollections: mongoose.Types.ObjectId[];
  perCategoryLocation: Map<string, NotificationPriority>;
  perCategory: Map<string, NotificationPriority>;
  perLocation: Map<string, NotificationPriority>;
  defaultPriority: NotificationPriority;

  dndEnabled: boolean;
  silentHours?: {
    start?: string | null;
    end?: string | null;
  } | null;

  muteHighGroups?: boolean;
  muteNormalGroups?: boolean;
  muteLowGroups?: boolean;
}

const NotificationPreferencesModel: Model<NotificationPreferences> =
  mongoose.model<NotificationPreferences>('NotificationPreferences', notificationPreferencesSchema);

export default NotificationPreferencesModel;
