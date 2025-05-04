import React, { useState, useEffect } from 'react';
import './Message.css';
import axios from 'axios';

const Message = ({ message, isCurrentUser, readBy = [], currentUser, selectedGroup, users = [], media, onReply }) => {
  const [replies, setReplies] = useState([]);
  const [showReplies, setShowReplies] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);

  useEffect(() => {
    if (showReplies && message._id) {
      console.log('Attempting to fetch replies for messageId:', message._id);
      setLoadingReplies(true);
      axios.get(`http://localhost:5000/api/messages/${message._id}/replies`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
        .then(res => {
          console.log('Replies received:', res.data.length);
          setReplies(res.data);
        })
        .catch(err => {
          console.error('Error fetching replies:', err);
          setReplies([]);
        })
        .finally(() => setLoadingReplies(false));
    }
  }, [showReplies, message._id]);

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

  const handleReply = () => {
    console.log('Reply button clicked for message:', message._id);
    if (typeof onReply === 'function') {
      onReply();
    } else {
      console.error('onReply is not a function');
    }
  };

  return (
    <div className={`message ${isCurrentUser ? 'current-user' : 'other-user'}`}>
      <div className="message-content">
        {parentPreview}
        <div className="message-text">{message.content} {readIndicator}</div>
        {mediaPreview}
        <div className="message-timestamp">{formatTime(message.timestamp)}</div>
        <div style={{ marginTop: 4, display: 'flex', gap: 8 }}>
          {message._id && (
            <>
              <button style={{ fontSize: 11, color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={handleReply}>Reply</button>
              <button style={{ fontSize: 11, color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => setShowReplies(v => !v)}>
                {showReplies ? 'Hide Thread' : 'Show Thread'}
              </button>
            </>
          )}
        </div>
        {showReplies && (
          <div style={{ marginTop: 8, marginLeft: 16, borderLeft: '2px solid #e3e3e3', paddingLeft: 8 }}>
            {loadingReplies ? (
              <div style={{ fontSize: 12, color: '#888' }}>Loading replies...</div>
            ) : replies.length === 0 ? (
              <div style={{ fontSize: 12, color: '#888' }}>No replies yet.</div>
            ) : (
              replies.map(reply => (
                <div key={reply._id} style={{ marginBottom: 8 }}>
                  <b style={{ fontSize: 12 }}>{users.find(u => u._id === reply.sender)?.username || 'User'}:</b> {reply.content || (reply.media ? reply.media.name : 'Media')}
                  {reply.media && reply.media.url && reply.media.type === 'image' && (
                    <img src={reply.media.url} alt={reply.media.name || 'image'} style={{ maxWidth: 120, maxHeight: 80, borderRadius: 4, marginLeft: 8, verticalAlign: 'middle' }} />
                  )}
                  <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>{formatTime(reply.timestamp)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Message; 