const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const router = express.Router();

// Register route
router.post('/register', async (req, res) => {
  try {
    const { email, password, phoneNumber, username } = req.body;

    // Validate input
    if (!email || !password || !phoneNumber || !username) {
      return res.status(400).json({ 
        error: 'Email, password, phone number, and username are required' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [
        { email },
        { phoneNumber }
      ]
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        error: existingUser.email === email ? 
          'Email already exists' : 
          'Phone number already exists'
      });
    }

    // Create new user (do NOT hash password here)
    const user = new User({
      email,
      password,
      phoneNumber,
      username
    });

    await user.save();

    // Create token
    const token = jwt.sign(
      { userId: user._id, username: user.username, email: user.email },
      process.env.JWT_SECRET
    );

    // Send response
    res.json({ token });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username, email: user.email },
      process.env.JWT_SECRET
    );

    res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get current user's profile
router.get('/profile', async (req, res) => {
  try {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.sendStatus(401);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId, 'username email profilePic');
    if (!user) return res.sendStatus(404);
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update current user's profile
router.post('/profile', async (req, res) => {
  try {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.sendStatus(401);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { username, email, profilePic } = req.body;
    const update = {};
    if (username) update.username = username;
    if (email) update.email = email;
    if (profilePic) update.profilePic = profilePic;
    const user = await User.findByIdAndUpdate(decoded.userId, update, { new: true, fields: 'username email profilePic' });
    if (!user) return res.sendStatus(404);
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router; 