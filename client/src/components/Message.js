import React from 'react';
import './Message.css';

const Message = ({ message, isCurrentUser, readBy = [], currentUser, selectedGroup, users = [], media }) => {
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

  // Media preview logic
  let mediaPreview = null;
  const m = media || message.media;
  if (m && m.url) {
    if (m.type === 'image') {
      mediaPreview = (
        <img src={m.url} alt={m.name || 'image'} style={{ maxWidth: 180, maxHeight: 120, borderRadius: 6, marginTop: 6 }} />
      );
    } else {
      mediaPreview = (
        <a href={m.url} download={m.name} style={{ fontSize: 12, color: '#1976d2', marginTop: 6, display: 'inline-block' }}>
          {m.name || 'Download file'}
        </a>
      );
    }
  }

  return (
    <div className={`message ${isCurrentUser ? 'current-user' : 'other-user'}`}>
      <div className="message-content">
        <div className="message-text">{message.content} {readIndicator}</div>
        {mediaPreview}
        <div className="message-timestamp">{formatTime(message.timestamp)}</div>
      </div>
    </div>
  );
};

export default Message; 