import React, { useState, useEffect, useRef, useCallback } from 'react';
import Message from './Message';
import ChatInput from './ChatInput';
import UserList from './UserList';
import axios from 'axios';
import './Chat.css';
import { v4 as uuidv4 } from 'uuid';
import ReplyModal from './ReplyModal';

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
  const [currentUsername, setCurrentUsername] = useState('');
  const [showGroupProfile, setShowGroupProfile] = useState(false);
  const [groupProfile, setGroupProfile] = useState(null);
  const [groupProfileLoading, setGroupProfileLoading] = useState(false);
  const [groupProfileError, setGroupProfileError] = useState('');
  const [groupPicFile, setGroupPicFile] = useState(null);
  const [addMemberId, setAddMemberId] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profilePicFile, setProfilePicFile] = useState(null);
  const [profileForm, setProfileForm] = useState({ username: '', email: '', profilePic: '' });
  const [typingUsers, setTypingUsers] = useState({}); // {userId: timestamp} for direct, {groupId: {userId: timestamp}} for group
  const [readBy, setReadBy] = useState({}); // {messageId: [userId, ...]}
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [showReplyModal, setShowReplyModal] = useState(false);

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
      setCurrentUsername(decoded.username || decoded.email || '');
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
      } else if (data.type === 'typing') {
        // Handle typing indicator
        if (data.groupId) {
          setTypingUsers(prev => ({
            ...prev,
            [data.groupId]: {
              ...(prev[data.groupId] || {}),
              [data.from]: Date.now()
            }
          }));
        } else if (data.from) {
          setTypingUsers(prev => ({
            ...prev,
            [data.from]: Date.now()
          }));
        }
      } else if (data.type === 'read') {
        // Update readBy state for messages
        setReadBy(prev => {
          const updated = { ...prev };
          data.messageIds.forEach(id => {
            updated[id] = updated[id] ? Array.from(new Set([...updated[id], data.userId])) : [data.userId];
          });
          return updated;
        });
      } else if (data.type === 'deleteMessage') {
        console.log('Received delete message event for:', data.messageId);
        setMessages(prev => prev.filter(msg => msg._id !== data.messageId));
        // TODO: Consider updating reply counts or removing replies from state if they were deleted.
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
        // Merge with existing if present
        const existing = map.get(msg._id) || {};
        map.set(msg._id, { ...existing, ...msg, media: msg.media || existing.media });
      } else if (msg._id) {
        const existing = map.get(msg._id) || {};
        map.set(msg._id, { ...existing, ...msg, media: msg.media || existing.media });
      } else if (msg.clientTempId) {
        const existing = map.get(msg.clientTempId) || {};
        map.set(msg.clientTempId, { ...existing, ...msg, media: msg.media || existing.media });
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

  // Filter messages for selected group or user, excluding replies
  const filteredMessages = messages.filter(msg => {
    // Exclude messages that are replies (have a parentMessage)
    if (msg.parentMessage) {
      return false;
    }
    // Include messages based on the selected group or user
    if (selectedGroup) {
      return msg.groupId === selectedGroup._id;
    } else if (selectedUser) {
      return (
        (msg.sender === currentUser && msg.receiver === selectedUser?._id) ||
        (msg.sender === selectedUser?._id && msg.receiver === currentUser)
      );
    }
    // If neither user nor group is selected, show nothing in the main list
    return false;
  });

  const handleSendMessage = (message, media, parentMessageId = null) => {
    if ((message.trim() === '' && !media) || (!selectedUser && !selectedGroup)) return;
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      const clientTempId = uuidv4();
      const parentMessage = parentMessageId || null;
      if (selectedGroup) {
        // Group message
        const messageData = {
          type: 'message',
          groupId: selectedGroup._id,
          content: message,
          clientTempId,
          media,
          parentMessage
        };
        ws.current.send(JSON.stringify(messageData));
        setMessages(prev => mergeMessages(prev, [{
          sender: currentUser,
          groupId: selectedGroup._id,
          content: message,
          timestamp: new Date(),
          clientTempId,
          media,
          parentMessage
        }]));
      } else if (selectedUser) {
        // Direct message
        const messageData = {
          type: 'message',
          receiverId: selectedUser._id,
          content: message,
          clientTempId,
          media,
          parentMessage
        };
        ws.current.send(JSON.stringify(messageData));
        setMessages(prev => mergeMessages(prev, [{
          sender: currentUser,
          receiver: selectedUser._id,
          content: message,
          timestamp: new Date(),
          clientTempId,
          media,
          parentMessage
        }]));
      }
      setReplyToMessage(null);
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

  // Fetch group profile
  const openGroupProfile = async () => {
    if (!selectedGroup) return;
    setGroupProfileLoading(true);
    setGroupProfileError('');
    try {
      const response = await axios.get(`http://localhost:5000/api/groups/${selectedGroup._id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setGroupProfile(response.data);
      setShowGroupProfile(true);
    } catch (error) {
      setGroupProfileError('Failed to load group profile');
    } finally {
      setGroupProfileLoading(false);
    }
  };

  // Update group picture
  const handleGroupPicChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // For demo: convert to base64
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        await axios.post(`http://localhost:5000/api/groups/${selectedGroup._id}/picture`, {
          picture: reader.result
        }, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        openGroupProfile(); // refresh
      } catch {
        alert('Failed to update group picture');
      }
    };
    reader.readAsDataURL(file);
  };

  // Remove member
  const handleRemoveMember = async (userId) => {
    try {
      await axios.post(`http://localhost:5000/api/groups/${selectedGroup._id}/remove`, { userId }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      openGroupProfile();
    } catch {
      alert('Failed to remove member');
    }
  };

  // Add member
  const handleAddMember = async () => {
    if (!addMemberId) return;
    try {
      await axios.post(`http://localhost:5000/api/groups/${selectedGroup._id}/add`, { userId: addMemberId }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setAddMemberId('');
      openGroupProfile();
    } catch {
      alert('Failed to add member');
    }
  };

  // Leave group
  const handleLeaveGroup = async () => {
    try {
      await axios.post(`http://localhost:5000/api/groups/${selectedGroup._id}/leave`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setShowGroupProfile(false);
      setSelectedGroup(null);
      // Optionally refresh group list
      const response = await axios.get('http://localhost:5000/api/groups', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setGroups(response.data);
    } catch {
      alert('Failed to leave group');
    }
  };

  // Fetch user profile
  const openProfileModal = async () => {
    setProfileLoading(true);
    setProfileError('');
    try {
      const response = await axios.get('http://localhost:5000/api/auth/profile', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setProfile(response.data);
      setProfileForm({
        username: response.data.username || '',
        email: response.data.email || '',
        profilePic: response.data.profilePic || ''
      });
      setShowProfileModal(true);
    } catch (error) {
      setProfileError('Failed to load profile');
    } finally {
      setProfileLoading(false);
    }
  };

  // Handle profile picture change
  const handleProfilePicChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileForm(form => ({ ...form, profilePic: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  // Handle profile form submit
  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError('');
    try {
      const response = await axios.post('http://localhost:5000/api/auth/profile', profileForm, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setProfile(response.data);
      setShowProfileModal(false);
      // Optionally update username in header
      setCurrentUsername(response.data.username);
    } catch (error) {
      setProfileError('Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  // Send typing event
  const sendTyping = useCallback(() => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    if (selectedGroup) {
      ws.current.send(JSON.stringify({ type: 'typing', groupId: selectedGroup._id }));
    } else if (selectedUser) {
      ws.current.send(JSON.stringify({ type: 'typing', receiverId: selectedUser._id }));
    }
  }, [selectedUser, selectedGroup]);

  // Typing indicator logic
  let typingIndicator = null;
  if (selectedGroup && typingUsers[selectedGroup._id]) {
    const typingMembers = Object.entries(typingUsers[selectedGroup._id])
      .filter(([userId, ts]) => Date.now() - ts < 2500 && userId !== currentUser)
      .map(([userId]) => {
        const user = users.find(u => u._id === userId);
        return user ? user.username : 'Someone';
      });
    if (typingMembers.length > 0) {
      typingIndicator = <div style={{ fontSize: 12, color: '#888', margin: '4px 0 0 8px' }}>{typingMembers.join(', ')} typing...</div>;
    }
  } else if (selectedUser && typingUsers[selectedUser._id] && Date.now() - typingUsers[selectedUser._id] < 2500) {
    typingIndicator = <div style={{ fontSize: 12, color: '#888', margin: '4px 0 0 8px' }}>{selectedUser.username} typing...</div>;
  }

  // Send read event when messages are viewed
  useEffect(() => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    // Only send read event for messages not yet read by current user
    let unreadMessages = filteredMessages.filter(m => m._id && !(readBy[m._id] || m.readBy || []).includes(currentUser) && m.sender !== currentUser);
    if (unreadMessages.length === 0) return;
    let messageIds = unreadMessages.map(m => m._id);
    if (selectedGroup) {
      ws.current.send(JSON.stringify({ type: 'read', messageIds, groupId: selectedGroup._id }));
    } else if (selectedUser) {
      ws.current.send(JSON.stringify({ type: 'read', messageIds, receiverId: selectedUser._id }));
    }
  }, [filteredMessages, selectedUser, selectedGroup, currentUser, readBy]);

  const handleOpenReplyModal = (message) => {
    setReplyToMessage(message);
    setShowReplyModal(true);
  };

  const handleSendReplyFromModal = (replyContent, parentMessageId, media = null) => {
    handleSendMessage(replyContent, media, parentMessageId);
    setShowReplyModal(false);
    setReplyToMessage(null);
  };

  return (
    <div className="chat-container compact">
      <div className="chat-header compact">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ fontSize: 20, margin: 0 }}>Chatter</h2>
          <span style={{ fontSize: 14, color: '#888', background: '#f0f0f0', borderRadius: 4, padding: '2px 8px' }}>
            {currentUsername ? `Logged in as: ${currentUsername}` : ''}
          </span>
          <button style={{ fontSize: 13, marginLeft: 8, padding: '4px 10px' }} onClick={openProfileModal}>
            Profile
          </button>
        </div>
        <button onClick={handleLogout} className="logout-button compact">Logout</button>
      </div>
      <div className="chat-main compact">
        <div style={{ display: 'flex', flexDirection: 'column', width: 220, minWidth: 180 }}>
          {/* Group Creation Button and Modal */}
          <button style={{ marginBottom: 8, fontSize: 13, padding: '6px 10px' }} onClick={() => setShowGroupModal(true)}>
            + Create Group
          </button>
          {showGroupModal && (
            <div style={{ background: '#fff', border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <form onSubmit={handleCreateGroup}>
                <div style={{ marginBottom: 6 }}>
                  <input
                    type="text"
                    placeholder="Group Name"
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    required
                    style={{ width: '100%', padding: 5, fontSize: 13 }}
                  />
                </div>
                <div style={{ marginBottom: 6, maxHeight: 80, overflowY: 'auto' }}>
                  {users.map(user => (
                    <label key={user._id} style={{ display: 'block', fontSize: 12 }}>
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
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="submit" style={{ fontSize: 13, padding: '4px 10px' }}>Create</button>
                  <button type="button" style={{ fontSize: 13, padding: '4px 10px' }} onClick={() => setShowGroupModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          )}
          {/* User and Group List */}
          <UserList 
            users={users} 
            selectedUser={selectedUser} 
            onSelectUser={user => {
              setSelectedUser(user);
              setSelectedGroup(null);
            }} 
            currentUser={currentUser}
          />
          <div className="group-list">
            <h3 style={{ fontSize: 15, margin: '10px 0 6px 0' }}>Groups</h3>
            <div className="groups">
              {groups.map(group => (
                <div
                  key={group._id}
                  className={`group-item ${selectedGroup?._id === group._id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedGroup(group);
                    setSelectedUser(null);
                  }}
                  style={{ cursor: 'pointer', padding: '6px', borderRadius: '5px', marginBottom: 3, background: selectedGroup?._id === group._id ? '#e3f2fd' : '#fff', fontSize: 13 }}
                >
                  {group.name}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="chat-content compact">
          {(selectedUser || selectedGroup) ? (
            <>
              <div className="chat-messages compact">
                {filteredMessages.map((message, index) => (
                  <Message
                    key={message._id || message.clientTempId || index}
                    message={message}
                    isCurrentUser={message.sender === currentUser}
                    readBy={readBy[message._id] || message.readBy || []}
                    currentUser={currentUser}
                    selectedGroup={selectedGroup}
                    users={users}
                    media={message.media}
                    onReply={handleOpenReplyModal}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
              {typingIndicator}
              <ChatInput onSendMessage={handleSendMessage} onTyping={sendTyping} />
              {/* Group Profile Button */}
              {selectedGroup && (
                <button style={{ marginTop: 8, fontSize: 13, padding: '4px 10px' }} onClick={openGroupProfile}>
                  Group Profile
                </button>
              )}
            </>
          ) : (
            <div className="select-user-message compact">
              Select a user or group to start chatting
            </div>
          )}
          {/* Group Profile Modal */}
          {showGroupProfile && groupProfile && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: '#fff', borderRadius: 10, padding: 24, minWidth: 320, maxWidth: 400, boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
                <h3 style={{ marginTop: 0 }}>{groupProfile.name}</h3>
                <div style={{ marginBottom: 12 }}>
                  <img src={groupProfile.picture || 'https://via.placeholder.com/80?text=Group'} alt="Group" style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', border: '1px solid #eee' }} />
                  <input type="file" accept="image/*" onChange={handleGroupPicChange} style={{ display: 'block', marginTop: 8 }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <b>Members:</b>
                  <ul style={{ paddingLeft: 18, margin: '6px 0' }}>
                    {groupProfile.members.map(member => (
                      <li key={member._id} style={{ marginBottom: 2, fontSize: 13 }}>
                        {member.username || member.email}
                        {member._id === currentUser ? ' (You)' : ''}
                        {groupProfile.members.length > 1 && member._id === currentUser ? (
                          <button style={{ marginLeft: 8, fontSize: 12 }} onClick={handleLeaveGroup}>Leave</button>
                        ) : null}
                        {member._id !== currentUser && (
                          <button style={{ marginLeft: 8, fontSize: 12 }} onClick={() => handleRemoveMember(member._id)}>Remove</button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <b>Add Member:</b>
                  <select value={addMemberId} onChange={e => setAddMemberId(e.target.value)} style={{ fontSize: 13, marginLeft: 6 }}>
                    <option value="">Select user</option>
                    {users.filter(u => !groupProfile.members.some(m => m._id === u._id)).map(u => (
                      <option key={u._id} value={u._id}>{u.username}</option>
                    ))}
                  </select>
                  <button style={{ fontSize: 12, marginLeft: 6 }} onClick={handleAddMember}>Add</button>
                </div>
                <button style={{ marginTop: 10, fontSize: 13 }} onClick={() => setShowGroupProfile(false)}>Close</button>
                {groupProfileError && <div style={{ color: 'red', marginTop: 8 }}>{groupProfileError}</div>}
              </div>
            </div>
          )}
          {/* Profile Modal */}
          {showProfileModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: '#fff', borderRadius: 10, padding: 24, minWidth: 320, maxWidth: 400, boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
                <h3 style={{ marginTop: 0 }}>Your Profile</h3>
                <form onSubmit={handleProfileSave}>
                  <div style={{ marginBottom: 12, textAlign: 'center' }}>
                    <img src={profileForm.profilePic || 'https://via.placeholder.com/80?text=User'} alt="Profile" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '1px solid #eee' }} />
                    <input type="file" accept="image/*" onChange={handleProfilePicChange} style={{ display: 'block', margin: '8px auto 0 auto' }} />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 13 }}>Username:</label>
                    <input
                      type="text"
                      value={profileForm.username}
                      onChange={e => setProfileForm(form => ({ ...form, username: e.target.value }))}
                      style={{ width: '100%', padding: 6, fontSize: 13, marginTop: 2 }}
                      required
                    />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 13 }}>Email:</label>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={e => setProfileForm(form => ({ ...form, email: e.target.value }))}
                      style={{ width: '100%', padding: 6, fontSize: 13, marginTop: 2 }}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button type="submit" style={{ fontSize: 13, padding: '4px 10px' }} disabled={profileLoading}>Save</button>
                    <button type="button" style={{ fontSize: 13, padding: '4px 10px' }} onClick={() => setShowProfileModal(false)}>Cancel</button>
                  </div>
                  {profileError && <div style={{ color: 'red', marginTop: 8 }}>{profileError}</div>}
                </form>
              </div>
            </div>
          )}
          {/* Reply Modal */}
          {showReplyModal && (
            <ReplyModal
              message={replyToMessage}
              onClose={() => setShowReplyModal(false)}
              onSendReply={handleSendReplyFromModal}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat; 