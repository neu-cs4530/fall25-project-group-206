// server/models/schema/notification.schema.ts
import { Schema, Types } from 'mongoose';

/**
 * Mongoose schema for the Notification collection.
 *
 * Each notification document represents an event delivered to a specific user,
 * such as a new question or answer in one of their bookmarked collections/communities.
 */
const notificationSchema = new Schema(
  {
    /**
     * Username of the notification recipient.
     */
    user: {
      type: String,
      required: true,
      index: true,
    },

    /**
     * Who performed the action (asker / answerer).
     */
    actor: {
      type: String,
      required: true,
    },

    /**
     * Human-readable message rendered in the inbox UI.
     */
    message: {
      type: String,
      required: true,
    },

    /**
     * When the underlying event occurred (askDateTime / ansDateTime).
     */
    eventDate: {
      type: Date,
      required: true,
      index: true,
    },

    /**
     * Id of the target (usually the Question _id).
     */
    targetId: {
      type: Types.ObjectId,
      required: true,
      index: true,
    },

    /**
     * Type of the underlying entity, e.g. Question or Answer.
     */
    targetType: {
      type: String,
      required: true,
      enum: ['Question', 'Answer'],
    },

    /**
     * Where this activity appears for the user.
     */
    location: {
      type: String,
      required: true,
      enum: ['collection', 'community', 'collection/community'],
    },

    /**
     * Optional direct link path for the frontend to use.
     */
    link: {
      type: String,
      required: false,
    },

    /**
     * Category used to distinguish backfill vs live events.
     */
    category: {
      type: String,
      enum: ['backfill', 'question', 'answer'],
      default: 'question',
    },

    /**
     * Read/unread state.
     */
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    collection: 'Notification',
    timestamps: false, // eventDate already captures the “when”
  },
);

export default notificationSchema;
