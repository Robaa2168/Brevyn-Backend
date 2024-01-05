// index.js

require('dotenv').config();
require('./cronJobs/expireTrades'); 
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const donationRoutes = require('./routes/donationRoutes');
const impactRoutes = require('./routes/impactRoutes');
const commentRoutes = require('./routes/commentRoutes');
const tradeRoutes = require('./routes/tradeRoutes');
const transactionRoutes = require('./routes/transactionRoutes');

// Initialize express app
const app = express();

// Use bodyParser to parse application/json content-type
app.use(bodyParser.json());

// Enable All CORS Requests for development
app.use(cors());

// Connect to MongoDB
mongoose.connect('mongodb+srv://robaa40:Lahaja40@cluster0.q02nnfd.mongodb.net/myCharityDb?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

// Use Auth Routes

app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/impacts', impactRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/trade', tradeRoutes);
app.use('/api/transactions', transactionRoutes);
app.get('/', (req, res) => res.send('Hello World with MERN!'));


// Listen on a port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
