import React from 'react';
import './UserList.css';

const UserList = ({ users, selectedUser, onSelectUser, currentUser }) => {
  return (
    <div className="user-list compact">
      <h3 style={{ fontSize: 15, margin: '10px 0 6px 0' }}>Online Users</h3>
      <div className="users compact">
        {users.map(user => (
          <div
            key={user._id}
            className={`user-item compact ${selectedUser?._id === user._id ? 'selected' : ''} ${user.online ? 'online' : 'offline'}${user._id === currentUser ? ' current-user-highlight' : ''}`}
            onClick={() => onSelectUser(user)}
            style={{ fontSize: 13, padding: '6px', borderRadius: 5, marginBottom: 3, background: selectedUser?._id === user._id ? '#e3f2fd' : '#fff' }}
          >
            <div className="user-info compact">
              <span className="username compact">{user.username}{user._id === currentUser ? ' (You)' : ''}</span>
              <span className="status compact">{user.online ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserList; 