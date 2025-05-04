import React, { useState } from 'react';
import axios from 'axios';

const Register = ({ onRegisterSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [username, setUsername] = useState('');
  const [profilePic, setProfilePic] = useState('');
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePic(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await axios.post('http://localhost:5000/api/auth/register', {
        email,
        password,
        phoneNumber,
        username,
        profilePic
      });
      
      // Call the success handler with the token
      onRegisterSuccess(response.data.token);
    } catch (err) {
      setError(err.response?.data?.error || 'Error registering user');
    }
  };

  return (
    <div className="auth-form">
      <h2>Register</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
          />
        </div>
        <div className="form-group">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            required
          />
        </div>
        <div className="form-group">
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="Phone Number"
            required
          />
        </div>
        <div className="form-group">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
          />
        </div>
        <div className="form-group">
          <label>Profile Picture (Optional):</label>
          <input type="file" accept="image/*" onChange={handleFileChange} />
          {profilePic && <img src={profilePic} alt="Preview" style={{ width: 50, height: 50, borderRadius: '50%', marginTop: 5 }}/>}
        </div>
        <button type="submit">Register</button>
      </form>
      <p>
        Already have an account?{' '}
        <button onClick={() => onRegisterSuccess(null)}>Login here</button>
      </p>
    </div>
  );
};

export default Register;
