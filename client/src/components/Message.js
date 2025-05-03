import React from 'react';
import './Message.css';

const Message = ({ message, isCurrentUser }) => {
  const formatTime = (timestamp) => {
    if (typeof timestamp === 'string') {
      return timestamp;
    }
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`message ${isCurrentUser ? 'current-user' : 'other-user'}`}>
      <div className="message-content">
        <div className="message-text">{message.content}</div>
        <div className="message-timestamp">{formatTime(message.timestamp)}</div>
      </div>
    </div>
  );
};

export default Message; 