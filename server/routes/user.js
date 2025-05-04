const express = require('express');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Middleware to authenticate token (reuse or define here)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user; // Attach user payload (including userId)
    next();
  });
};

// Block a user
router.post('/block/:userIdToBlock', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userIdToBlock = req.params.userIdToBlock;

    if (userId === userIdToBlock) {
      return res.status(400).json({ error: "You cannot block yourself." });
    }

    // Add userIdToBlock to the current user's blockedUsers list
    await User.findByIdAndUpdate(
      userId,
      { $addToSet: { blockedUsers: userIdToBlock } }, // Use $addToSet to prevent duplicates
      { new: true } 
    );

    res.status(200).json({ message: 'User blocked successfully.' });
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).json({ error: 'Failed to block user.' });
  }
});

// Unblock a user
router.post('/unblock/:userIdToUnblock', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userIdToUnblock = req.params.userIdToUnblock;

    // Remove userIdToUnblock from the current user's blockedUsers list
    await User.findByIdAndUpdate(
      userId,
      { $pull: { blockedUsers: userIdToUnblock } },
      { new: true }
    );

    res.status(200).json({ message: 'User unblocked successfully.' });
  } catch (error) {
    console.error('Error unblocking user:', error);
    res.status(500).json({ error: 'Failed to unblock user.' });
  }
});

// Get blocked users list (optional)
router.get('/blocked', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate('blockedUsers', 'username _id profilePic');
    res.json(user.blockedUsers || []);
  } catch (error) {
    console.error('Error fetching blocked users:', error);
    res.status(500).json({ error: 'Failed to fetch blocked users.' });
  }
});

module.exports = router; 