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
const { env } = require('process');
const config = require('../config-test');
const { getAccessTokenFromStorage } = require('../routes/hs_auth');

const router = express.Router();   

const environment = process.env.NODE_ENV || 'development';
const environmentConfig = config[environment];
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');

const pool = new Pool({
    connectionString: environmentConfig.databaseUrl,
    ssl: {
      rejectUnauthorized: false // This is needed for local development, remove it for production
    }
  });

  router.get('/deal-properties', async (req, res) => {
    try {
      const accessTokenPromise = getAccessTokenFromStorage(); // Get the access token as a Promise
      const accessToken = await accessTokenPromise;  // Get the access token dynamically
      console.log(accessToken);
      const hubspotClient = new hubspot.Client({ accessToken });

      const objectType = "objectType";
      const archived = false;
      const properties = undefined;

   
      const dealProperties = await hubspotClient.crm.properties.coreApi.getAll(objectType, archived, properties);

      console.log(JSON.stringify(dealProperties, null, 2));

      res.json(dealProperties);
    } catch (error) {
      console.error('Error retrieving deal:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });



  router.get('/all-deals', async (req, res) => {
    try {
      const accessTokenPromise = getAccessTokenFromStorage(); // Get the access token as a Promise
      const accessToken = await accessTokenPromise; // Get the access token dynamically
      console.log(accessToken);
      const hubspotClient = new hubspot.Client({ accessToken });
  
      const limit = 10;
      let after = undefined;
      let allDeals = [];
  
      while (true) {
        const { results, paging } = await hubspotClient.crm.deals.basicApi.getPage(
          undefined,
          limit,
          after
        );
  
        allDeals.push(...results);
  
        if (paging.next) {
          // Extract the 'after' value from the next link to use in the next iteration
          const nextLink = new URL(paging.next);
          after = nextLink.searchParams.get('after');
        } else {
          break; // No more pages, exit the loop
        }
      }
  
      console.log(JSON.stringify(allDeals, null, 2));
  
      // Define the CSV writer and file path
      const csvWriter = createCsvWriter({
        path: path.join(__dirname, 'deals.csv'), // Set the file path according to your repository structure
        header: Object.keys(allDeals[0]).map((key) => ({ id: key, title: key })),
      });
  
      // Write the deals to the CSV file
      await csvWriter.writeRecords(allDeals);
  
      res.json(allDeals);
    } catch (error) {
      console.error('Error retrieving deals:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

