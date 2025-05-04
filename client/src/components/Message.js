import React from 'react';
import './Message.css';

const Message = ({ message, isCurrentUser, readBy = [], currentUser, selectedGroup, users = [] }) => {
  const formatTime = (timestamp) => {
    if (typeof timestamp === 'string') {
      return timestamp;
    }
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Read receipt logic
  let readIndicator = null;
  if (isCurrentUser && message._id) {
    if (selectedGroup) {
      // Group: show avatars or count for users who have read (excluding self)
      const others = readBy.filter(uid => uid !== currentUser);
      if (others.length > 0) {
        readIndicator = (
          <span style={{ fontSize: 10, color: '#1976d2', marginLeft: 6 }}>
            Read by {others.length} {others.length === 1 ? 'member' : 'members'}
          </span>
        );
      }
    } else {
      // Direct: show checkmark if recipient has read
      if (readBy.some(uid => uid !== currentUser)) {
        readIndicator = <span style={{ fontSize: 13, color: '#1976d2', marginLeft: 6 }}>✓✓</span>;
      }
    }
  }

  return (
    <div className={`message ${isCurrentUser ? 'current-user' : 'other-user'}`}>
      <div className="message-content">
        <div className="message-text">{message.content} {readIndicator}</div>
        <div className="message-timestamp">{formatTime(message.timestamp)}</div>
      </div>
    </div>
  );
};

export default Message; 