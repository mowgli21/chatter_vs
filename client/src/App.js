import React, { useState } from 'react';
import Chat from './components/Chat';
import Login from './Login';
import Register from './Register';
import './App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isRegistering, setIsRegistering] = useState(false);

  const handleLogin = (token) => {
    localStorage.setItem('token', token);
    setToken(token);
  };

  const handleRegisterSuccess = (token) => {
    if (token) {
      localStorage.setItem('token', token);
      setToken(token);
    } else {
      setIsRegistering(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-container">
        {isRegistering ? (
          <Register onRegisterSuccess={handleRegisterSuccess} />
        ) : (
          <Login
            onLogin={handleLogin}
            onSwitchToRegister={() => setIsRegistering(true)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Chatter</h1>
      </header>
      <main>
        <Chat />
      </main>
    </div>
  );
}

export default App;
