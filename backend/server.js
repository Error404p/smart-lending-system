require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// CORS Middleware (supports local Vite, Vercel frontend, or wildcard)
const clientUrl = process.env.CLIENT_URL;
app.use(cors({
  origin: clientUrl ? [clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'] : true,
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/items', require('./routes/items'));
app.use('/api/loans', require('./routes/loans'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Root & Health check routes for cloud load balancers & monitoring
app.get('/', (req, res) => {
  res.json({
    name: 'Smart Lending System API',
    status: 'online',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      items: '/api/items',
      loans: '/api/loans',
      dashboard: '/api/dashboard'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// DB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart-lending';
const PORT = process.env.PORT || 5000;

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('MongoDB connected successfully.');
    // Auto-sync indexes (including Partial Unique Index for loan concurrency guard)
    const Loan = require('./models/Loan');
    await Loan.syncIndexes();
    console.log('Database indexes synchronized.');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Database connection error:', err);
    process.exit(1);
  });
