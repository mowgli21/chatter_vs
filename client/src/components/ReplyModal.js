import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ReplyModal = ({ message, onClose, onSendReply }) => {
  const [replyContent, setReplyContent] = useState('');
  const [replies, setReplies] = useState([]);
  const [loadingReplies, setLoadingReplies] = useState(false);

  // Fetch replies when modal opens
  useEffect(() => {
    if (message?._id) {
      setLoadingReplies(true);
      axios.get(`http://localhost:5000/api/messages/${message._id}/replies`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
        .then(res => setReplies(res.data))
        .catch(err => console.error('Error fetching replies for modal:', err))
        .finally(() => setLoadingReplies(false));
    }
  }, [message?._id]);

  // Log received replies for debugging
  useEffect(() => {
    if (replies.length > 0) {
      console.log('Replies received in modal:', replies);
      // Log media field of the first reply if available
      if (replies[0].media) {
        console.log('Media in first reply:', replies[0].media);
      }
    }
  }, [replies]);

  if (!message) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (replyContent.trim()) {
      onSendReply(replyContent, message._id);
      setReplyContent('');
      // Note: We don't re-fetch replies here, assuming the main Chat component will update.
    }
  };

  // Helper for simple time formatting
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: 24, minWidth: 400, maxWidth: 550, boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
        <h4 style={{ marginTop: 0, marginBottom: 12 }}>Reply to Message</h4>
        {/* Parent Message Preview - Improved */}
        <div style={{ background: '#f0f7ff', borderLeft: '3px solid #1976d2', padding: '6px 12px', marginBottom: 12, borderRadius: 6, fontSize: 13 }}>
          <b>Original:</b> 
          {message.content}
          {message.media?.url && message.media.type === 'image' && (
            <img 
              src={message.media.url} 
              alt={message.media.name || 'image'} 
              style={{ maxWidth: 80, maxHeight: 50, borderRadius: 4, marginLeft: 8, verticalAlign: 'middle' }} 
            />
          )}
          {!message.content && message.media && message.media.type !== 'image' && (
            <span>{message.media.name || 'File'}</span>
          )}
        </div>
        
        {/* Display Existing Replies */}
        <div style={{ marginBottom: 16, maxHeight: 150, overflowY: 'auto', borderTop: '1px solid #eee', paddingTop: 8 }}>
          <h5 style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>Existing Replies</h5>
          {loadingReplies ? (
            <div style={{ fontSize: 12, color: '#888' }}>Loading replies...</div>
          ) : replies.length === 0 ? (
            <div style={{ fontSize: 12, color: '#888' }}>No replies yet.</div>
          ) : (
            replies.map(reply => (
              <div key={reply._id} style={{ marginBottom: 6, fontSize: 12 }}>
                <b>{reply.sender?.username || 'User'}:</b> {reply.content || (reply.media ? reply.media.name : 'Media')}
                {reply.media?.url && reply.media.type === 'image' && (
                  <img src={reply.media.url} alt={reply.media.name || 'image'} style={{ maxWidth: 60, maxHeight: 40, borderRadius: 4, marginLeft: 8, verticalAlign: 'middle' }} />
                )}
                <span style={{ fontSize: 11, color: '#aaa', marginLeft: 8 }}>{formatTime(reply.timestamp)}</span>
              </div>
            ))
          )}
        </div>
        
        {/* Reply Input Form */}
        <form onSubmit={handleSubmit}>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Type your reply..."
            rows={3}
            style={{ width: '100%', padding: 8, fontSize: 13, border: '1px solid #ccc', borderRadius: 4, marginBottom: 8 }}
            required
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" style={{ fontSize: 13, padding: '6px 12px' }}>Send Reply</button>
            <button type="button" style={{ fontSize: 13, padding: '6px 12px' }} onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReplyModal; 