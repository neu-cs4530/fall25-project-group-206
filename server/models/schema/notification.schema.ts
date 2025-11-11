import { Schema } from 'mongoose';

/**
 * Mongoose schema for the Notification collection.
 *
 * Each notification corresponds to an update event that the user should see
 * in their feed — such as changes to a bookmarked Collection, Community, or Question.
 */
const notificationSchema = new Schema(
  {
    /**
     * The username of the user receiving this notification.
     */
    user: {
      type: String,
      required: true,
      index: true,
    },

    /**
     * Text message describing the update.
     */
    message: {
      type: String,
      required: true,
    },

    /**
     * The logical category of this notification.
     * Used for grouping and filtering in the frontend.
     */
    category: {
      type: String,
      enum: [
        'bookmark_update',
        'message',
        'mention',
        'system',
        'bookmark_backfill',
        'community_activity',
      ],
      default: 'system',
    },

    /**
     * The ID of the entity that triggered this notification.
     */
    targetId: {
      type: Schema.Types.ObjectId,
      required: false,
    },

    /**
     * The type of the target entity.
     * e.g., Collection, Community, User, Question, Answer.
     */
    targetType: {
      type: String,
      enum: ['Collection', 'Community', 'User', 'Question', 'Answer'],
      required: false,
    },

    /**
     * The frontend route this notification should link to.
     * Example: `/collections/username/123`, `/questions/456`, `/users/789`
     */
    link: {
      type: String,
      required: false,
    },

    /**
     * The date and time when the event that triggered this notification occurred.
     * Used for sorting notifications in chronological order.
     */
    eventDate: {
      type: Date,
      required: false,
      index: true,
    },

    /**
     * Whether the user has already viewed this notification.
     */
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    collection: 'Notification',
    timestamps: true, // adds createdAt and updatedAt
  },
);

export default notificationSchema;
