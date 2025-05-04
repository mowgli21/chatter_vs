import React, { useState, useEffect } from 'react';
import './Message.css';
import axios from 'axios';

const Message = ({ message, isCurrentUser, readBy = [], currentUser, selectedGroup, users = [], media, onReply }) => {
  const [replyCount, setReplyCount] = useState(0);

  // Fetch reply count when message ID is available
  useEffect(() => {
    if (message._id) {
      axios.get(`http://localhost:5000/api/messages/${message._id}/replies/count`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
        .then(res => setReplyCount(res.data.count))
        .catch(err => console.error('Error fetching reply count:', err));
    }
  }, [message._id]);

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

  // Parent message preview (if this is a reply)
  let parentPreview = null;
  console.log('Parent message check:', { 
    hasParent: !!message.parentMessage,
    parentMessage: message.parentMessage
  });
  
  if (message.parentMessage) {
    let parentContent = '';
    if (typeof message.parentMessage === 'string') {
      // If it's just an ID, show a placeholder
      parentContent = 'Original message';
    } else if (message.parentMessage.content) {
      // If it's an object with content
      parentContent = message.parentMessage.content;
    } else if (message.parentMessage.media) {
      // If it has media
      parentContent = message.parentMessage.media.name || 'Media';
    } else {
      // Fallback
      parentContent = 'Referenced message';
    }
    
    parentPreview = (
      <div style={{ background: '#f0f7ff', borderLeft: '3px solid #1976d2', padding: '4px 10px', borderRadius: 5, fontSize: 12, marginBottom: 4 }}>
        Replying to: <b>{parentContent}</b>
      </div>
    );
  }

  // Debug message properties
  console.log('Rendering message:', { 
    id: message._id, 
    content: message.content?.substring(0, 20), 
    isCurrentUser, 
    hasParent: !!message.parentMessage 
  });

  const handleDelete = async () => {
    if (!message._id || !window.confirm('Are you sure you want to delete this message?')) {
      return;
    }
    try {
      console.log('Attempting to delete message:', message._id);
      await axios.delete(`http://localhost:5000/api/messages/${message._id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      // Message removal is handled by WebSocket event
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Failed to delete message.');
    }
  };

  const sender = users.find(u => u._id === message.sender);

  return (
    <div className={`message ${isCurrentUser ? 'current-user' : 'other-user'}`}>
      {/* Avatar for other users */} 
      {!isCurrentUser && (
        <img 
          src={sender?.profilePic || 'https://via.placeholder.com/30?text=' + (sender?.username?.charAt(0).toUpperCase() || 'U')}
          alt={sender?.username || 'User'}
          style={{ width: 30, height: 30, borderRadius: '50%', marginRight: 8, marginTop: 5, alignSelf: 'flex-start' }}
        />
      )}
      <div className="message-content">
        {/* Optional: Show sender name for group messages from others */} 
        {selectedGroup && !isCurrentUser && sender && (
          <div style={{ fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 3 }}>
            {sender.username}
          </div>
        )}
        {parentPreview}
        <div className="message-text">{message.content} {readIndicator}</div>
        {mediaPreview}
        <div className="message-timestamp">{formatTime(message.timestamp)}</div>
        <div style={{ marginTop: 4, display: 'flex', gap: 8 }}>
          {message._id && (
            <button 
              style={{ fontSize: 11, color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onClick={() => onReply(message)} // Open modal via Chat.js
            >
              Reply/Thread {replyCount > 0 ? `(${replyCount})` : ''}
            </button>
          )}
          {isCurrentUser && message._id && (
            <button 
              style={{ fontSize: 11, color: '#dc3545', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 8 }}
              onClick={handleDelete}
            >
              Delete
            </button>
          )}
        </div>
      </div>
      {/* Avatar for current user */}
      {isCurrentUser && (
        <img 
          src={currentUser.profilePic || 'https://via.placeholder.com/30?text=' + (currentUser.username?.charAt(0).toUpperCase() || 'U')}
          alt={currentUser.username || 'You'}
          style={{ width: 30, height: 30, borderRadius: '50%', marginLeft: 8, marginTop: 5, alignSelf: 'flex-start' }}
        />
      )}
    </div>
  );
};

export default Message; 