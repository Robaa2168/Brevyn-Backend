// index.js
require('dotenv').config();
require('./cronJobs/expireTrades');
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const authRoutes = require('./routes/authRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const donationRoutes = require('./routes/donationRoutes');
const impactRoutes = require('./routes/impactRoutes');
const commentRoutes = require('./routes/commentRoutes');
const tradeRoutes = require('./routes/tradeRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const reportRoutes = require('./routes/reportRoutes');
const chatRoutes = require('./routes/chatRoutes');
const reviewRoutes = require('./routes/reviewRoutes');




const PORT = process.env.PORT || 5000;

// Initialize express app
const app = express();

// Create an HTTP server and pass the Express app
const server = http.createServer(app);

// Attach socket.io to the server
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow your client origin
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true
  }
});

global.io = io;
// Use bodyParser to parse application/json content-type
app.use(bodyParser.json());

// Enable All CORS Requests for development
app.use(cors());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

// Define your routes
app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/impacts', impactRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/trade', tradeRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/abuse', reportRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/reviews', reviewRoutes);
app.get('/', (req, res) => res.send('Hello World with MERN!'));

// Handling Socket.IO connections
io.on('connection', (socket) => {
  console.log('Client connected');

  // Handling disconnection
  socket.on('disconnect', (reason) => {
    console.log(`Client disconnected due to ${reason}`);
  });

  // Handle any Socket.IO errors
  socket.on('error', (error) => {
    console.error('Socket.IO Error', error);
  });
});

// Listen on a port with the HTTP server, not the Express app
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
