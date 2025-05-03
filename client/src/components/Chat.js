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
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState([]);
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

    // Fetch groups for the current user
    const fetchGroups = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/groups', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setGroups(response.data);
      } catch (error) {
        console.error('Error fetching groups:', error);
      }
    };

    fetchGroups();

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
    // Fetch messages when a user or group is selected
    const fetchMessages = async () => {
      if (selectedGroup) {
        try {
          const response = await axios.get(`http://localhost:5000/api/groups/${selectedGroup._id}/messages`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          });
          setMessages(prev => mergeMessages(prev, response.data));
        } catch (error) {
          console.error('Error fetching group messages:', error);
        }
      } else if (selectedUser) {
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
  }, [selectedUser, selectedGroup, mergeMessages]);

  // Filter messages for selected group or user
  const filteredMessages = selectedGroup
    ? messages.filter(msg => msg.groupId === selectedGroup._id)
    : selectedUser
      ? messages.filter(
          (msg) =>
            (msg.sender === currentUser && msg.receiver === selectedUser?._id) ||
            (msg.sender === selectedUser?._id && msg.receiver === currentUser)
        )
      : [];

  const handleSendMessage = (message) => {
    if (message.trim() === '' || (!selectedUser && !selectedGroup)) return;
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      const clientTempId = uuidv4();
      if (selectedGroup) {
        // Group message
        const messageData = {
          type: 'message',
          groupId: selectedGroup._id,
          content: message,
          clientTempId
        };
        ws.current.send(JSON.stringify(messageData));
        // Optimistically add the message to the UI
        setMessages(prev => mergeMessages(prev, [{
          sender: currentUser,
          groupId: selectedGroup._id,
          content: message,
          timestamp: new Date(),
          clientTempId
        }]));
      } else if (selectedUser) {
        // Direct message
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
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.reload();
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName || newGroupMembers.length === 0) return;
    try {
      const response = await axios.post('http://localhost:5000/api/groups', {
        name: newGroupName,
        members: newGroupMembers
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setGroups(prev => [...prev, response.data]);
      setShowGroupModal(false);
      setNewGroupName('');
      setNewGroupMembers([]);
    } catch (error) {
      alert('Failed to create group');
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>Chatter</h2>
        <button onClick={handleLogout} className="logout-button">Logout</button>
      </div>
      <div className="chat-main">
        <div style={{ display: 'flex', flexDirection: 'column', width: 250 }}>
          {/* Group Creation Button and Modal */}
          <button style={{ marginBottom: 10 }} onClick={() => setShowGroupModal(true)}>
            + Create Group
          </button>
          {showGroupModal && (
            <div style={{ background: '#fff', border: '1px solid #ccc', borderRadius: 8, padding: 16, marginBottom: 10 }}>
              <form onSubmit={handleCreateGroup}>
                <div style={{ marginBottom: 8 }}>
                  <input
                    type="text"
                    placeholder="Group Name"
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    required
                    style={{ width: '100%', padding: 6 }}
                  />
                </div>
                <div style={{ marginBottom: 8, maxHeight: 100, overflowY: 'auto' }}>
                  {users.map(user => (
                    <label key={user._id} style={{ display: 'block', fontSize: 14 }}>
                      <input
                        type="checkbox"
                        checked={newGroupMembers.includes(user._id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setNewGroupMembers(members => [...members, user._id]);
                          } else {
                            setNewGroupMembers(members => members.filter(id => id !== user._id));
                          }
                        }}
                      />
                      {user.username}
                    </label>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit">Create</button>
                  <button type="button" onClick={() => setShowGroupModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          )}
          <UserList 
            users={users} 
            selectedUser={selectedUser} 
            onSelectUser={user => {
              setSelectedUser(user);
              setSelectedGroup(null);
            }} 
          />
          <div className="group-list">
            <h3>Groups</h3>
            <div className="groups">
              {groups.map(group => (
                <div
                  key={group._id}
                  className={`group-item ${selectedGroup?._id === group._id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedGroup(group);
                    setSelectedUser(null);
                  }}
                  style={{ cursor: 'pointer', padding: '8px', borderRadius: '6px', marginBottom: 4, background: selectedGroup?._id === group._id ? '#e3f2fd' : '#fff' }}
                >
                  {group.name}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="chat-content">
          {(selectedUser || selectedGroup) ? (
            <>
              <div className="chat-messages">
                {filteredMessages.map((message, index) => (
                  <Message
                    key={message._id || message.clientTempId || index}
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
              Select a user or group to start chatting
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat; 