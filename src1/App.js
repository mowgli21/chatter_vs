import React, { useState } from 'react';
import Login from './Login';
import axios from 'axios';

const App = () => {
  const [token, setToken] = useState(localStorage.getItem('token'));

  const handleLogin = (token) => {
    localStorage.setItem('token', token);
    setToken(token);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  const fetchHelloWorld = async () => {
    try {
      const response = await axios.get('http://localhost:3000/api/hello', {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert(response.data);
    } catch (error) {
      alert('Error fetching data');
    }
  };

  return (
    <div>
      {token ? (
        <div>
          <button onClick={fetchHelloWorld}>Fetch Hello World</button>
          <button onClick={handleLogout}>Logout</button>
        </div>
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </div>
  );
};

export default App; 