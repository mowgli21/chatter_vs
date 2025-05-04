import React, { useState } from 'react';
import EmojiPicker from 'emoji-picker-react';
import './ChatInput.css';

const ChatInput = ({ onSendMessage, onTyping }) => {
  const [message, setMessage] = useState('');
  const [file, setFile] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() || file) {
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          onSendMessage(message, {
            url: reader.result,
            type: file.type.startsWith('image') ? 'image' : 'file',
            name: file.name
          });
          setFile(null);
        };
        reader.readAsDataURL(file);
      } else {
        onSendMessage(message);
      }
      setMessage('');
    }
  };

  const handleChange = (e) => {
    setMessage(e.target.value);
    if (onTyping) onTyping();
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleEmojiClick = (emojiObject) => {
    setMessage(prevMessage => prevMessage + emojiObject.emoji);
    setShowEmojiPicker(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={message}
          onChange={handleChange}
          placeholder="Type a message..."
          className="chat-input"
        />
        {/* Emoji Button */}
        <button 
          type="button" 
          className="emoji-button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
        >
          Emoji
        </button>
        <input type="file" onChange={handleFileChange} className="file-input" />
        <button type="submit" className="send-button">
          Send
        </button>
        {file && (
          <span style={{ fontSize: 12, marginLeft: 8 }}>{file.name}</span>
        )}
      </form>
      {showEmojiPicker && (
        <div style={{ position: 'absolute', bottom: '60px', right: '100px', zIndex: 100 }}>
          <EmojiPicker onEmojiClick={handleEmojiClick} />
        </div>
      )}
    </div>
  );
};

export default ChatInput; 