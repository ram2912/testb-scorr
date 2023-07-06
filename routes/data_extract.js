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
const url = require('url');

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

  let propertyNames = [];

  router.get('/deal-properties', async (req, res) => {
    try {
      const accessTokenPromise = getAccessTokenFromStorage(); // Get the access token as a Promise
      const accessToken = await accessTokenPromise;  // Get the access token dynamically
      console.log(accessToken);
      const hubspotClient = new hubspot.Client({ accessToken });

      const objectType = "deal";
      const archived = false;
      const properties = undefined;

   
      const dealPropertiesResponse = await hubspotClient.crm.properties.coreApi.getAll(objectType, archived, properties);
      const dealProperties = dealPropertiesResponse.results;
      const propertyNames = dealProperties.map(property => property.name);
  
      console.log(`Retrieved ${dealProperties.length} properties`);

      res.json(propertyNames);
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
  
      const limit = 100;
      let after = undefined;
      const properties = propertyNames;
      const propertiesWithHistory = undefined;
      const associations = undefined;
      const archived = false;
      let allDeals = [];
  
      while (true) {
        const { results, paging } = await hubspotClient.crm.deals.basicApi.getPage(
          limit,
          after,
          properties,
          propertiesWithHistory,
          associations,
          archived
        );

        const filteredDeals = results.filter(deal => new Date(deal.createdAt) > new Date('2022-10-01'));
  
        allDeals.push(...filteredDeals);
  
        if (paging && paging.next && paging.next.link) {
          const nextPageUrl = new URL(paging.next.link);
          after = nextPageUrl.searchParams.get('after');
        } else {
          break; // No more pages, exit the loop
        }
      }
  
      console.log(`Retrieved ${allDeals.length} deals`);

      const folderPath = "./test_extract";
  
      // Define the CSV writer and file path
      const csvWriter = createCsvWriter({
        path: path.join(folderPath, 'deals.csv'), // Set the file path according to your repository structure
        header: Object.keys(allDeals[0]).map((key) => ({ id: key, title: key })),
      });
  
      try {
        // Write the deals to the CSV file
        await csvWriter.writeRecords(allDeals);
        console.log('CSV file created successfully');
      } catch (error) {
        console.error('Error writing to CSV file:', error);
      }
  
      res.json(allDeals);
    } catch (error) {
      console.error('Error retrieving deals:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  router.get('/download-deals', (req, res) => {
    const filePath = path.join(__dirname, 'test_extract/deals.csv');
    res.download(filePath);
  });

  module.exports = {
    router,  
}


