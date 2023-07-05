const express = require('express');
require('dotenv').config();
const app = express();
const request = require('request-promise-native');
const NodeCache = require('node-cache');
const session = require('express-session');
const hubspot = require('@hubspot/api-client');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');
const { Configuration, OpenAIApi } = require("openai");
const config = require('./config-test');

const environment = process.env.NODE_ENV || 'development';
const environmentConfig = config[environment];

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const dealsRoutes = require('./routes/deals');

app.use(cors({
  origin: ['https://www.scorr-app.eu','http://localhost:3000', 'https://test.scorr-app.eu'],
  credentials: true
}));


const pool = new Pool({
    connectionString: environmentConfig.databaseUrl,
    ssl: {
      rejectUnauthorized: false // This is needed for local development, remove it for production
    }
  });

  async function checkDealsTableExists() {
    try {
      const query = `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_name = 'deals'
        )
      `;
  
      const result = await pool.query(query);
      return result.rows[0].exists;
    } catch (error) {
      console.error('Error checking if "deals" table exists:', error);
      return false;
    }
  }

  // Function to create the 'deals' table
  async function createDealsTable() {
    try {
      const query = `
        CREATE TABLE deals (
          id VARCHAR(255) PRIMARY KEY,
          amount DECIMAL,
          closedate TIMESTAMP,
          createdate TIMESTAMP,
          dealname VARCHAR(255),
          dealstage VARCHAR(255),
          hs_lastmodifieddate TIMESTAMP,
          hs_object_id VARCHAR(255),
          pipeline VARCHAR(255)
        )
      `;
  
      await pool.query(query);
      console.log('The "deals" table has been created successfully.');
    } catch (error) {
      console.error('Error creating "deals" table:', error);
    }
  }
  
  // Function to set up the 'deals' table if it doesn't exist
  async function setupDealsTable() {
    const tableExists = await checkDealsTableExists();
    if (!tableExists) {
      await createDealsTable();
    }
  }

  app.use(bodyParser.json());


 
  
  // Call the function to set up the 'deals' table
  setupDealsTable();

  app.use('/auth', authRoutes);
app.use('/deals', dealsRoutes);


app.listen(PORT, () => console.log(`Server started on Port ${PORT}`));