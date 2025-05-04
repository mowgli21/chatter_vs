const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const { WebSocket } = require('ws');
const http = require('http');

// Import routes
const authRoutes = require('./routes/auth');
const groupRoutes = require('./routes/group');

// Import models
const User = require('./models/User');
const Message = require('./models/Message');
const Group = require('./models/Group');

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);

// WebSocket connection handling
const clients = new Map(); // Map<userId, ws[]>

wss.on('connection', (ws) => {
  let userId = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('WebSocket message received:', data);
      
      if (data.type === 'auth') {
        try {
          const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
          userId = decoded.userId;
          if (!clients.has(userId)) {
            clients.set(userId, []);
          }
          clients.get(userId).push(ws);
          
          // Update user online status
          await User.findByIdAndUpdate(userId, { online: true });
          
          // Notify all clients about the new online user
          broadcastOnlineUsers();
        } catch (error) {
          console.error('Authentication error:', error);
          ws.close();
        }
      } else if (data.type === 'message') {
        if (!userId) {
          ws.close();
          return;
        }

        if (data.parentMessage) {
          console.log('Message with parentMessage:', data.parentMessage);
        }

        if (data.groupId) {
          // GROUP MESSAGE
          if (data.media) {
            console.log('Received media:', data.media.type, data.media.name, data.media.url ? data.media.url.slice(0, 30) : '');
          }
          const message = new Message({
            sender: userId,
            groupId: data.groupId,
            content: data.content,
            timestamp: new Date(),
            media: data.media || undefined,
            parentMessage: data.parentMessage || null
          });
          await message.save();
          // Fetch the saved message to ensure media is populated as stored
          const savedMessage = await Message.findById(message._id);

          // Fetch group members
          const group = await Group.findById(data.groupId);
          if (group) {
            for (const memberId of group.members) {
              const memberSockets = clients.get(memberId.toString());
              if (memberSockets && memberSockets.length > 0) {
                memberSockets.forEach(sock => {
                  if (sock.readyState === WebSocket.OPEN) {
                    sock.send(JSON.stringify({
                      type: 'message',
                      message: {
                        _id: savedMessage._id,
                        sender: userId,
                        groupId: data.groupId,
                        content: data.content,
                        timestamp: savedMessage.timestamp,
                        clientTempId: data.clientTempId,
                        media: savedMessage.media,
                        parentMessage: savedMessage.parentMessage
                      }
                    }));
                  }
                });
              }
            }
          }
        } else {
          // DIRECT MESSAGE
          if (data.media) {
            console.log('Received media:', data.media.type, data.media.name, data.media.url ? data.media.url.slice(0, 30) : '');
          }
          const message = new Message({
            sender: userId,
            receiver: data.receiverId,
            content: data.content,
            timestamp: new Date(),
            media: data.media || undefined,
            parentMessage: data.parentMessage || null
          });
          await message.save();
          // Fetch the saved message to ensure media is populated as stored
          const savedMessage = await Message.findById(message._id);

          // Send message to receiver if online
          const receiverSockets = clients.get(data.receiverId);
          if (receiverSockets && receiverSockets.length > 0) {
            console.log('Sending message to receiver:', data.receiverId);
            receiverSockets.forEach(sock => {
              if (sock.readyState === WebSocket.OPEN) {
                sock.send(JSON.stringify({
                  type: 'message',
                  message: {
                    _id: savedMessage._id,
                    sender: userId,
                    receiver: data.receiverId,
                    content: data.content,
                    timestamp: savedMessage.timestamp,
                    clientTempId: data.clientTempId,
                    media: savedMessage.media,
                    parentMessage: savedMessage.parentMessage
                  }
                }));
              }
            });
          } else {
            console.log('Receiver not online:', data.receiverId);
          }

          // Send message back to sender for confirmation
          console.log('Sending message back to sender:', userId);
          if (clients.has(userId)) {
            clients.get(userId).forEach(sock => {
              if (sock.readyState === WebSocket.OPEN) {
                sock.send(JSON.stringify({
                  type: 'message',
                  message: {
                    _id: savedMessage._id,
                    sender: userId,
                    receiver: data.receiverId,
                    content: data.content,
                    timestamp: savedMessage.timestamp,
                    clientTempId: data.clientTempId,
                    media: savedMessage.media,
                    parentMessage: savedMessage.parentMessage
                  }
                }));
              }
            });
          }
        }
      } else if (data.type === 'typing') {
        if (!userId) return;
        if (data.groupId) {
          // Typing in group chat: notify all group members except sender
          const group = await Group.findById(data.groupId);
          if (group) {
            for (const memberId of group.members) {
              if (memberId.toString() === userId) continue;
              const memberSockets = clients.get(memberId.toString());
              if (memberSockets && memberSockets.length > 0) {
                memberSockets.forEach(sock => {
                  if (sock.readyState === WebSocket.OPEN) {
                    sock.send(JSON.stringify({
                      type: 'typing',
                      from: userId,
                      groupId: data.groupId
                    }));
                  }
                });
              }
            }
          }
        } else if (data.receiverId) {
          // Typing in direct chat: notify receiver
          const receiverSockets = clients.get(data.receiverId);
          if (receiverSockets && receiverSockets.length > 0) {
            receiverSockets.forEach(sock => {
              if (sock.readyState === WebSocket.OPEN) {
                sock.send(JSON.stringify({
                  type: 'typing',
                  from: userId
                }));
              }
            });
          }
        }
      } else if (data.type === 'read') {
        if (!userId || !data.messageIds) return;
        // Mark messages as read by this user, but only if not already present
        const updatedIds = [];
        for (const id of data.messageIds) {
          const message = await Message.findById(id);
          if (message && !message.readBy.includes(userId)) {
            message.readBy.push(userId);
            await message.save();
            updatedIds.push(id);
          }
        }
        if (updatedIds.length === 0) return; // No updates, don't broadcast
        // Broadcast read status
        if (data.groupId) {
          // Group: notify all group members
          const group = await Group.findById(data.groupId);
          if (group) {
            for (const memberId of group.members) {
              const memberSockets = clients.get(memberId.toString());
              if (memberSockets && memberSockets.length > 0) {
                memberSockets.forEach(sock => {
                  if (sock.readyState === WebSocket.OPEN) {
                    sock.send(JSON.stringify({
                      type: 'read',
                      messageIds: updatedIds,
                      userId
                    }));
                  }
                });
              }
            }
          }
        } else if (data.receiverId) {
          // Direct: notify sender and receiver
          [data.receiverId, userId].forEach(uid => {
            const sockets = clients.get(uid);
            if (sockets && sockets.length > 0) {
              sockets.forEach(sock => {
                if (sock.readyState === WebSocket.OPEN) {
                  sock.send(JSON.stringify({
                    type: 'read',
                    messageIds: updatedIds,
                    userId
                  }));
                }
              });
            }
          });
        }
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', async () => {
    if (userId) {
      if (clients.has(userId)) {
        // Remove this socket from the user's array
        const arr = clients.get(userId).filter(sock => sock !== ws);
        if (arr.length === 0) {
          clients.delete(userId);
          await User.findByIdAndUpdate(userId, { online: false });
        } else {
          clients.set(userId, arr);
        }
        broadcastOnlineUsers();
      }
    }
  });
});

// Function to broadcast WebSocket messages
const broadcast = (data, senderWs = null) => {
  wss.clients.forEach(client => {
    // Optional: Don't send back to the sender
    // if (senderWs && client === senderWs) return;
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

// Modify broadcastOnlineUsers to use the global broadcast function
async function broadcastOnlineUsers() {
  try {
    const onlineUsers = await User.find({ online: true }, 'username _id');
    broadcast({
      type: 'onlineUsers',
      users: onlineUsers
    });
  } catch (error) {
    console.error('Error broadcasting online users:', error);
  }
}

// Authentication middleware
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

// Protected routes
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.userId } }, 'username online _id');
    res.json(users);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/messages/:userId', authenticateToken, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user.userId, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.user.userId }
      ]
    }).sort('timestamp');
    
    res.json(messages);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Fetch all replies to a given message (thread)
app.get('/api/messages/:messageId/replies', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching replies for messageId:', req.params.messageId);
    const parentMessage = await Message.findById(req.params.messageId);
    if (!parentMessage) {
      console.log('Parent message not found!');
      return res.status(404).json({ error: 'Parent message not found' });
    }
    
    // Populate sender information for replies
    const replies = await Message.find({ parentMessage: req.params.messageId })
                                   .populate('sender', 'username')
                                   .sort('timestamp');
                                   
    console.log('Replies found:', replies.length);
    if (replies.length > 0) {
      console.log('Sample reply:', {
        id: replies[0]._id,
        content: replies[0].content,
        parentMessage: replies[0].parentMessage,
        senderUsername: replies[0].sender?.username
      });
    }
    res.json(replies);
  } catch (error) {
    console.error('Error fetching replies:', error);
    res.status(400).json({ error: error.message });
  }
});

// Fetch reply count for a given message
app.get('/api/messages/:messageId/replies/count', authenticateToken, async (req, res) => {
  try {
    const count = await Message.countDocuments({ parentMessage: req.params.messageId });
    res.json({ count });
  } catch (error) {
    console.error('Error fetching reply count:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete a message
app.delete('/api/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const userId = req.user.userId;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Ensure only the sender can delete their message
    if (message.sender.toString() !== userId) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    // Perform the delete
    await Message.findByIdAndDelete(messageId);

    // Broadcast the delete event via WebSocket
    broadcast({
      type: 'deleteMessage',
      messageId: messageId,
      // Include context for frontend filtering
      conversationId: message.receiver || message.groupId 
    });

    res.status(200).json({ message: 'Message deleted successfully' });

  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
