import { Schema, Types } from 'mongoose';

const notificationSchema = new Schema(
  {
    user: {
      type: String,
      required: true,
      index: true,
    },
    actor: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    eventDate: {
      type: Date,
      required: true,
      index: true,
    },
    targetId: {
      type: Types.ObjectId,
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      required: true,
      // ADD 'User'
      enum: ['Question', 'Answer', 'User'],
    },
    location: {
      type: String,
      required: true,
      // ADD 'following'
      enum: ['collection', 'community', 'collection/community', 'following', 'direct'],
    },
    link: {
      type: String,
      required: false,
    },
    category: {
      type: String,
      // ADD 'follow'
      enum: ['backfill', 'question', 'answer', 'follow', 'direct'],
      default: 'question',
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    collection: 'Notification',
    timestamps: false,
  },
);

export default notificationSchema;
