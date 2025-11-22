// FILE: server/models/schema/notificationPreferences.schema.ts
import { Schema, Types } from 'mongoose';

const notificationPreferencesSchema = new Schema(
  {
    user: {
      type: Types.ObjectId,
      required: true,
      index: true,
      unique: true,
    },
    mutedUsers: {
      type: [String],
      default: [],
    },
    mutedCommunities: {
      type: [Types.ObjectId],
      default: [],
    },
    mutedCollections: {
      type: [Types.ObjectId],
      default: [],
    },
    perCategoryLocation: {
      type: Map,
      of: String,
      default: {},
    },
    perCategory: {
      type: Map,
      of: String,
      default: {},
    },
    perLocation: {
      type: Map,
      of: String,
      default: {},
    },
    defaultPriority: {
      type: String,
      enum: ['high', 'normal', 'low'],
      default: 'normal',
    },

    dndEnabled: { type: Boolean, default: false },
    silentHours: {
      start: { type: String, default: null }, // e.g. '22:00'
      end: { type: String, default: null }, // e.g. '07:00'
    },

    muteHighGroups: { type: Boolean, default: false },
    muteNormalGroups: { type: Boolean, default: false },
    muteLowGroups: { type: Boolean, default: false },
  },
  {
    collection: 'NotificationPreferences',
    timestamps: false,
  },
);

export default notificationPreferencesSchema;
