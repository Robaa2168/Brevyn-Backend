// index.js

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

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
app.get('/', (req, res) => res.send('Hello World with MERN!'));


// Listen on a port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
