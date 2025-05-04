const express = require('express');
const Group = require('../models/Group');
const Message = require('../models/Message');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Create a new group
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, members } = req.body;
    if (!name || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ error: 'Name and members are required' });
    }
    // Add creator to members if not already included
    if (!members.includes(req.user.userId)) {
      members.push(req.user.userId);
    }
    const group = new Group({ name, members });
    await group.save();
    res.json(group);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all groups for the current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Include the picture field
    const groups = await Group.find({ members: req.user.userId }, 'name picture');
    res.json(groups);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Add a member to a group
router.post('/:groupId/add', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    const group = await Group.findByIdAndUpdate(
      req.params.groupId,
      { $addToSet: { members: userId } },
      { new: true }
    );
    res.json(group);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Remove a member from a group
router.post('/:groupId/remove', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    const group = await Group.findByIdAndUpdate(
      req.params.groupId,
      { $pull: { members: userId } },
      { new: true }
    );
    res.json(group);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get messages for a group
router.get('/:groupId/messages', authenticateToken, async (req, res) => {
  try {
    const messages = await Message.find({ groupId: req.params.groupId })
                                    .populate('sender', 'username profilePic')
                                    .sort('timestamp');
    res.json(messages);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update group picture
router.post('/:groupId/picture', authenticateToken, async (req, res) => {
  try {
    const { picture } = req.body; // Expect a URL or base64 string
    const group = await Group.findByIdAndUpdate(
      req.params.groupId,
      { picture },
      { new: true }
    );
    res.json(group);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Leave group (remove self from group)
router.post('/:groupId/leave', authenticateToken, async (req, res) => {
  try {
    const group = await Group.findByIdAndUpdate(
      req.params.groupId,
      { $pull: { members: req.user.userId } },
      { new: true }
    );
    res.json(group);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get group details
router.get('/:groupId', authenticateToken, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId)
                           .populate('members', 'username email profilePic');
    res.json(group);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router; 