const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config-test');
const cookieParser = require('cookie-parser');



const environment = process.env.NODE_ENV || 'development';
const environmentConfig = config[environment];

const pool = new Pool({
  connectionString: environmentConfig.databaseUrl,
  ssl: {
    rejectUnauthorized: false // This is needed for local development, remove it for production
  }
});

router.use(cookieParser());

// GET /users/:userId - Get user details
router.get('/:userId', async (req, res) => {
  // ...
});

// ... other user-specific routes ...
// POST /users/login - User login
router.get('/protected', (req, res) => {
  try{
    return res.json({ message: 'You are authorized' });
  } catch (error) {
    console.error('Error during signup:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Fetch user details from the database using the username
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];

    // Compare the provided password with the hashed password stored in the database
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Password is valid, generate a JWT token
    const token = jwt.sign({ userId: user.id }, 'your-secret-key');

    res.cookie('token', token, {
      httpOnly: true,
      secure: true, // Set to true if serving over HTTPS
      // maxAge: expirationTime, // Set the expiration time if needed
    });

    // Return the token and user details
    return res.status(200).json({ token, user });
  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Middleware function to verify the JWT token and authenticate the user
function verifyToken(req, res, next) {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Verify and decode the token
    const decoded = jwt.verify(token, 'your-secret-key');

    // Attach the decoded data (userId) to the request object for further use
    req.user = decoded;

    // Proceed to the next middleware or route handler
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    console.error('Error verifying token:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}


// POST /users/signup - User signup
router.post('/signup', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check if the username already exists in the database
    const existingUser = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash the password before storing it in the database
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user in the database
    const newUser = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *',
      [username, hashedPassword]
    );

    const user = newUser.rows[0];

    // Generate a JWT token for the new user
    const token = jwt.sign({ userId: user.id }, 'your-secret-key');
    
    res.cookie('token', token, {
      httpOnly: true,
      secure: true, // Set to true if serving over HTTPS
      // maxAge: expirationTime, // Set the expiration time if needed
    });

    // Return the token and user details
    return res.status(201).json({ token, user });
  } catch (error) {
    console.error('Error during signup:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Example route that requires authentication


router.get('/all-users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    const users = result.rows;
    return res.json({ users });
  } catch (error) {
    console.error('Error retrieving users:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});




module.exports = {
  router,
  verifyToken
};
