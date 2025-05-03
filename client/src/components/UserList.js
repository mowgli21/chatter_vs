import React from 'react';
import './UserList.css';

const UserList = ({ users, selectedUser, onSelectUser }) => {
  return (
    <div className="user-list">
      <h3>Online Users</h3>
      <div className="users">
        {users.map(user => (
          <div
            key={user._id}
            className={`user-item ${selectedUser?._id === user._id ? 'selected' : ''} ${user.online ? 'online' : 'offline'}`}
            onClick={() => onSelectUser(user)}
          >
            <div className="user-info">
              <span className="username">{user.username}</span>
              <span className="status">{user.online ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserList; 