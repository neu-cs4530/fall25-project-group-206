import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './index.css';
import { DatabaseMessage } from '../../../types/types';
import { getMetaData } from '../../../tool';

/**
 * MessageCard component displays a single message with its sender and timestamp.
 *
 * @param message: The message object to display.
 */
const MessageCard = ({ message }: { message: DatabaseMessage }) => (
  <div className='message'>
    <div className='message-header'>
      <div className='message-sender'>{message.msgFrom}</div>
      <div className='message-time'>{getMetaData(new Date(message.msgDateTime))}</div>
    </div>
    <div className='message-body'>
      <Markdown remarkPlugins={[remarkGfm]}>{message.msg}</Markdown>
    </div>
  </div>
);

export default MessageCard;
