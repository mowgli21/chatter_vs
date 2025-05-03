import React, { useState, useEffect, useRef, useCallback } from 'react';
import Message from './Message';
import ChatInput from './ChatInput';
import UserList from './UserList';
import axios from 'axios';
import './Chat.css';
import { v4 as uuidv4 } from 'uuid';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const ws = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Get current user from token
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = JSON.parse(atob(token.split('.')[1]));
      setCurrentUser(decoded.userId);
    }

    // Connect to WebSocket
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsHost = window.location.hostname;
    const wsPort = 5000; // Change if your server runs on a different port
    ws.current = new WebSocket(`${wsProtocol}://${wsHost}:${wsPort}`);

    ws.current.onopen = () => {
      console.log('WebSocket Connected');
      // Authenticate with token
      ws.current.send(JSON.stringify({
        type: 'auth',
        token: localStorage.getItem('token')
      }));
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('WebSocket message received on client:', data);
      if (data.type === 'message') {
        setMessages(prev => mergeMessages(prev, [data.message]));
      } else if (data.type === 'onlineUsers') {
        setUsers(data.users);
      }
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.current.onclose = () => {
      console.log('WebSocket disconnected');
    };

    // Fetch users
    const fetchUsers = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/users', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setUsers(response.data);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchUsers();

    return () => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.close();
      }
      ws.current = null;
    };
  }, []);

  // Helper to merge and deduplicate messages by _id or clientTempId
  const mergeMessages = useCallback((oldMessages, newMessages) => {
    const map = new Map();
    // First, add all old messages
    oldMessages.forEach(msg => {
      if (msg._id) {
        map.set(msg._id, msg);
      } else if (msg.clientTempId) {
        map.set(msg.clientTempId, msg);
      } else {
        map.set(JSON.stringify([msg.sender, msg.receiver, msg.content, msg.timestamp]), msg);
      }
    });
    // Now, add/replace with new messages
    newMessages.forEach(msg => {
      // Ensure sender and receiver are present
      if (!msg.receiver && selectedUser) {
        msg.receiver = selectedUser._id;
      }
      if (!msg.sender && currentUser) {
        msg.sender = currentUser;
      }
      if (msg._id && msg.clientTempId) {
        // Remove any optimistic message with the same clientTempId
        map.delete(msg.clientTempId);
        map.set(msg._id, msg);
      } else if (msg._id) {
        map.set(msg._id, msg);
      } else if (msg.clientTempId) {
        map.set(msg.clientTempId, msg);
      } else {
        map.set(JSON.stringify([msg.sender, msg.receiver, msg.content, msg.timestamp]), msg);
      }
    });
    return Array.from(map.values()).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [selectedUser, currentUser]);

  useEffect(() => {
    // Fetch messages when a user is selected
    const fetchMessages = async () => {
      if (selectedUser) {
        try {
          const response = await axios.get(`http://localhost:5000/api/messages/${selectedUser._id}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          });
          setMessages(prev => mergeMessages(prev, response.data));
        } catch (error) {
          console.error('Error fetching messages:', error);
        }
      }
    };
    fetchMessages();
  }, [selectedUser, mergeMessages]);

  // Filter messages to only show those between currentUser and selectedUser
  const filteredMessages = messages.filter(
    (msg) =>
      (msg.sender === currentUser && msg.receiver === selectedUser?._id) ||
      (msg.sender === selectedUser?._id && msg.receiver === currentUser)
  );

  const handleSendMessage = (message) => {
    if (message.trim() === '' || !selectedUser) return;
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      const clientTempId = uuidv4();
      const messageData = {
        type: 'message',
        receiverId: selectedUser._id,
        content: message,
        clientTempId
      };
      ws.current.send(JSON.stringify(messageData));
      // Optimistically add the message to the UI
      setMessages(prev => mergeMessages(prev, [{
        sender: currentUser,
        receiver: selectedUser._id,
        content: message,
        timestamp: new Date(),
        clientTempId
      }]));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.reload();
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>Chatter</h2>
        <button onClick={handleLogout} className="logout-button">Logout</button>
      </div>
      <div className="chat-main">
        <UserList 
          users={users} 
          selectedUser={selectedUser} 
          onSelectUser={setSelectedUser} 
        />
        <div className="chat-content">
          {selectedUser ? (
            <>
              <div className="chat-messages">
                {filteredMessages.map((message, index) => (
                  <Message
                    key={message._id || index}
                    message={message}
                    isCurrentUser={message.sender === currentUser}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
              <ChatInput onSendMessage={handleSendMessage} />
            </>
          ) : (
            <div className="select-user-message">
              Select a user to start chatting
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat; 