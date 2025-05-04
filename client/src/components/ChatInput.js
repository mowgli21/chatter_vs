import React, { useState } from 'react';
import './ChatInput.css';

const ChatInput = ({ onSendMessage, onTyping }) => {
  const [message, setMessage] = useState('');
  const [file, setFile] = useState(null);

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

  return (
    <form className="chat-input-form" onSubmit={handleSubmit}>
      <input
        type="text"
        value={message}
        onChange={handleChange}
        placeholder="Type a message..."
        className="chat-input"
      />
      <input type="file" onChange={handleFileChange} className="file-input" />
      <button type="submit" className="send-button">
        Send
      </button>
      {file && (
        <span style={{ fontSize: 12, marginLeft: 8 }}>{file.name}</span>
      )}
    </form>
  );
};

export default ChatInput; 