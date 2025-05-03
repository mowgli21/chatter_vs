const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const WebSocket = require('ws');
const http = require('http');

// Import routes
const authRoutes = require('./routes/auth');

// Import models
const User = require('./models/User');
const Message = require('./models/Message');

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

        const message = new Message({
          sender: userId,
          receiver: data.receiverId,
          content: data.content,
          timestamp: new Date()
        });
        
        await message.save();
        
        // Send message to receiver if online
        const receiverSockets = clients.get(data.receiverId);
        if (receiverSockets && receiverSockets.length > 0) {
          console.log('Sending message to receiver:', data.receiverId);
          receiverSockets.forEach(sock => {
            if (sock.readyState === WebSocket.OPEN) {
              sock.send(JSON.stringify({
                type: 'message',
                message: {
                  _id: message._id,
                  sender: userId,
                  receiver: data.receiverId,
                  content: data.content,
                  timestamp: message.timestamp,
                  clientTempId: data.clientTempId
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
                  _id: message._id,
                  sender: userId,
                  receiver: data.receiverId,
                  content: data.content,
                  timestamp: message.timestamp,
                  clientTempId: data.clientTempId
                }
              }));
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

async function broadcastOnlineUsers() {
  try {
    const onlineUsers = await User.find({ online: true }, 'username _id');
    const message = JSON.stringify({
      type: 'onlineUsers',
      users: onlineUsers
    });
    
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
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

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
