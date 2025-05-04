import React from 'react';
import axios from 'axios';
import './UserList.css';

const UserList = ({ users, selectedUser, onSelectUser, currentUser, blockedUsers = [], onBlockToggle }) => {
  return (
    <div className="user-list compact">
      <h3 style={{ fontSize: 15, margin: '10px 0 6px 0' }}>Online Users</h3>
      <div className="users compact">
        {users.map(user => {
          console.log('Rendering user in list:', user);
          return (
            <div
              key={user._id}
              className={`user-item compact ${selectedUser?._id === user._id ? 'selected' : ''} ${user.online ? 'online' : 'offline'}${user._id === currentUser ? ' current-user-highlight' : ''}`}
              onClick={() => onSelectUser(user)}
              style={{ cursor: 'pointer', padding: '6px', borderRadius: '5px', marginBottom: 3, background: selectedUser?._id === user._id ? '#e3f2fd' : '#fff', display: 'flex', alignItems: 'center' }}
            >
              {/* Avatar */}
              <img 
                src={user.profilePic || 'https://via.placeholder.com/30?text=' + user.username.charAt(0).toUpperCase()} 
                alt={user.username}
                style={{ width: 30, height: 30, borderRadius: '50%', marginRight: 8, objectFit: 'cover' }} 
              />
              <div className="user-info compact">
                <span className="username compact">{user.username}{user._id === currentUser ? ' (You)' : ''}</span>
                <span className="status compact">{user.online ? 'Online' : 'Offline'}</span>
              </div>
              {/* Block/Unblock Button */}
              {user._id !== currentUser && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onBlockToggle(user._id); }}
                  style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 6px', cursor: 'pointer' }}
                >
                  {blockedUsers.includes(user._id) ? 'Unblock' : 'Block'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UserList; 