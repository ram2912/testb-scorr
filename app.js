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

app.use(cors({
  origin: ['https://www.scorr-app.eu','http://localhost:3000'],
  credentials: true
}));


const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
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

  async function checkPipelinesTableExists() {
    try {
      const query = `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_name = 'pipelines'
        )
      `;
  
      const result = await pool.query(query);
      return result.rows[0].exists;
    } catch (error) {
      console.error('Error checking if "pipelines" table exists:', error);
      return false;
    }
  }

  async function createPipelineTable(){
    try{
      const query = `
      CREATE TABLE pipelines (
        id SERIAL PRIMARY KEY,
        pipelineID VARCHAR(255),
        name VARCHAR(255) NOT NULL
      )
    `;
      await pool.query(query);
      console.log('The "pipelines" table has been created successfully.');
    } catch (error) {
      console.error('Error creating "pipelines" table:', error);
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
  app.post('/register', async (req, res) => {
    const { username, password } = req.body;
  
    try {
      // Check if the user already exists
      const existingUser = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'User already exists' });
      }
  
      // Insert the new user into the database
      const newUser = await pool.query('INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id', [
        username,
        password,
      ]);
  
      // Create an empty pipelines array for the user
      
  
      return res.status(200).json({ message: 'User registered successfully' });
    } catch (error) {
      console.error('Error registering user:', error);
      return res.status(500).json({ error: 'An error occurred while registering user' });
    }
  });
  
  // Call the function to set up the 'deals' table
  setupDealsTable();

const refreshTokenStore = {};
const accessTokenCache = new NodeCache({ deleteOnExpire: true });

const CLIENT_ID = '94a8188f-5484-474f-b8a4-5eb80fc5d5db';
const CLIENT_SECRET = 'c7f173fa-411e-480a-b5e9-d90a0c01a385';

PORT = process.env.PORT || 5001;

// Scopes for this app will default to `crm.objects.contacts.read`
// To request others, set the SCOPE environment variable instead
const SCOPES = ['crm.objects.deals.read'];

if (process.env.SCOPE) {
    SCOPES = (process.env.SCOPE.split(/ |, ?|%20/)).join(' ');
}

// On successful install, users will be redirected to /oauth-callback
const REDIRECT_URI = `https://backend.scorr-app.eu/oauth-callback`;

//===========================================================================//

// Use a session to keep track of client ID
app.use(session({
  secret: Math.random().toString(36).substring(2),
  resave: false,
  saveUninitialized: true
}));
 
//================================//
//   Running the OAuth 2.0 Flow   //
//================================//

// Step 1
// Build the authorization URL to redirect a user
// to when they choose to install the app
const authUrl =
  'https://app.hubspot.com/oauth/authorize' +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` + // app's client ID
  `&scope=${encodeURIComponent(SCOPES)}` + // scopes being requested by the app
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`; // where to send the user after the consent page

// Redirect the user from the installation page to
// the authorization URL
app.get('/install', (req, res) => {
  console.log('');
  console.log('=== Initiating OAuth 2.0 flow with HubSpot ===');
  console.log('');
  console.log("===> Step 1: Redirecting user to your app's OAuth URL");

  // Generate a random state value
  const state = Math.random().toString(36).substring(2);

  // Store the state value in the session
  req.session.state = state;

  // Build the authorization URL with the state parameter
  const authUrl =
    'https://app.hubspot.com/oauth/authorize' +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&state=${encodeURIComponent(state)}`;

  // Redirect the user to the authorization URL
  res.redirect(authUrl);
  console.log('===> Step 2: User is being prompted for consent by HubSpot');
});


// Step 2
// The user is prompted to give the app access to the requested
// resources. This is all done by HubSpot, so no work is necessary
// on the app's end

// Step 3
// Receive the authorization code from the OAuth 2.0 Server,
// and process it based on the query parameters that are passed
app.get('/oauth-callback', async (req, res) => {
  console.log('===> Step 3: Handling the request sent by the server');

  // Received a user authorization code, so now combine that with the other
  // required values and exchange both for an access token and a refresh token
  if (req.query.code) {
    console.log('       > Received an authorization token');

    const authCodeProof = {
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code: req.query.code
    };

    // Step 4
    // Exchange the authorization code for an access token and refresh token
    console.log('===> Step 4: Exchanging authorization code for an access token and refresh token');
    const token = await exchangeForTokens(req.sessionID, authCodeProof);
    if (token.message) {
      return res.redirect(`/error?msg=${token.message}`);
    }

    // Once the tokens have been retrieved, use them to make a query
    // to the HubSpot API
    
    res.redirect(`/`);
  }
});

//==========================================//
//   Exchanging Proof for an Access Token   //
//==========================================//

const exchangeForTokens = async (userId, exchangeProof) => {
  try {
    const responseBody = await request.post('https://api.hubapi.com/oauth/v1/token', {
      form: exchangeProof
    });
    // Usually, this token data should be persisted in a database and associated with
    // a user identity.
    const tokens = JSON.parse(responseBody);
    refreshTokenStore[userId] = tokens.refresh_token;
    accessTokenCache.set(userId, tokens.access_token, Math.round(tokens.expires_in * 0.75));

    console.log('       > Received an access token and refresh token');
    return tokens.access_token;
  } catch (e) {
    console.error(`       > Error exchanging ${exchangeProof.grant_type} for access token`);
    return JSON.parse(e.response.body);
  }
};

const refreshAccessToken = async (userId) => {
  const refreshTokenProof = {
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    refresh_token: refreshTokenStore[userId]
  };
  return await exchangeForTokens(userId, refreshTokenProof);
};

const getAccessToken = async (userId) => {
  // If the access token has expired, retrieve
  // a new one using the refresh token
  if (!accessTokenCache.get(userId)) {
    console.log('Refreshing expired access token');
    await refreshAccessToken(userId);
  }
  return accessTokenCache.get(userId);
};

const isAuthorized = (userId) => {
  return refreshTokenStore[userId] ? true : false;
};

//====================================================//
//   Using an Access Token to Query the HubSpot API   //
//====================================================//

const getContacts = async (accessToken) => {
  console.log('');
  console.log('=== Retrieving contacts from HubSpot using the access token ===');
  try {
    const headers1 = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
    console.log('===> Replace the following request.get() to test other API calls');
    console.log('===> request.get(\'https://api.hubapi.com/contacts/v1/lists/all/contacts/all?count=1\')');
    const result = await request.get('https://api.hubapi.com/contacts/v1/lists/all/contacts/all', {
      headers: headers1
    });
    return JSON.parse(result).contacts;
  } catch (e) {
    console.error('  > Unable to retrieve contacts');
    return JSON.parse(e.response.body);
  }
};


const getPipeline = async (accessToken) => {
  console.log('');
  console.log('=== Retrieving contacts from HubSpot using the access token ===');
  try {
    const objectType = "deals";
    const headers1 = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
    
    const result = await request.get(`https://api.hubapi.com/crm/v3/pipelines/${objectType}`, {
      headers: headers1
    });
    console.log('API Response:', result);

    return JSON.parse(result);
  } catch (e) {
    console.error('  > Unable to retrieve contacts');
    return JSON.parse(e.response.body);
  }
};

const getPipelinestage = async (accessToken) => {

try {
   // Get the access token dynamically
   // Pass the access token to the hubspotClient
   const objectType = "deals";

   const headers2 = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };
   const apiResponse = await request.get(`https://api.hubapi.com/crm/v3/pipelines/${objectType}`, {
  headers: headers2
}); return JSON.stringify(apiResponse, null, 2).stages;
}
catch (e) {
  e.message === 'HTTP request failed'
    ? console.error(JSON.stringify(e.response, null, 2))
    : console.error(e);
}
};

app.get('/pipelines', async (req, res) => {
  try {
    const accessToken = req.headers.authorization.split(' ')[1];// Get the access token dynamically
    const hubspotClient = new hubspot.Client({ accessToken });
    const objectType = "deals";
    

    const apiResponse = await hubspotClient.crm.pipelines.pipelinesApi.getAll(objectType);
   

    const pipelines = apiResponse.results.map((pipeline) => ({
      label: pipeline.label,
      id: pipeline.id,
      stages: pipeline.stages.map((stage) => ({
        label: stage.label,
        id: stage.id,
        displayOrder: stage.displayOrder,
      })),
    }));



    res.json(pipelines);
  } catch (e) {
    e.message === 'HTTP request failed'
      ? console.error(JSON.stringify(e.response, null, 2))
      : console.error(e);
  }
});

app.get('/pipelines2', async (req, res) => {
  try {
    const accessToken = await getAccessToken(req.sessionID);
    const pipelines = await getPipeline(accessToken);
    console.log('Pipelines:', pipelines);

    res.json(pipelines);

  } catch (error) {
    console.error('Error retrieving deal:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.get('/pipelinestage', async (req, res) => {
    try {
      const accessToken = await getAccessToken(req.sessionID); // Get the access token dynamically
      const hubspotClient = new hubspot.Client({ accessToken });
      const objectType = "deals";
      const pipelineId = "27911521";
  
      const apiResponse = await hubspotClient.crm.pipelines.pipelineStagesApi.getAll(objectType, pipelineId);
  
      const pipelineStages = apiResponse.results.map((stage) => {
        return {
          label: stage.label,
          displayOrder: stage.displayOrder
        };
      });
  
      res.json(pipelineStages);
    } catch (e) {
      e.message === 'HTTP request failed'
        ? console.error(JSON.stringify(e.response, null, 2))
        : console.error(e);
    }
  });

  

//properties with names and descriptions
app.get('/properties', async (req, res) => {
    try {
      if (isAuthorized(req.sessionID)){
      const accessToken = await getAccessToken(req.sessionID); // Get the access token dynamically
      const hubspotClient = new hubspot.Client({ accessToken });
      const objectType = "deals";
      const archived = false;
      const properties = undefined;
  
      // Retrieve the properties for the specified stage
      const apiResponse = await hubspotClient.crm.properties.coreApi.getAll(objectType, archived, properties);
      // Extract the relevant fields from the stage properties
      
      const propertyNames = apiResponse.results.map((property) => {
        return {
            name: property.name,
            description: property.description
            
        };
        });
        res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
        res.header('Access-Control-Allow-Credentials', true);
      res.json(propertyNames, null, 2);
      }else{
        res.status(401).json({ error: 'Unauthorized' });
      }
    } catch (e) {
        e.message === 'HTTP request failed'
        ? console.error(JSON.stringify(e.response, null, 2))
        : console.error(e)
    }
});


  

app.get('/contacts', async (req, res) => {
 
    try {
      console.log('Request Headers:', req.headers);
      if (isAuthorized(req.sessionID)) {
        const accessToken = await getAccessToken(req.sessionID);
        const contacts = await getContacts(accessToken);
        res.json(contacts);
      } else {
        res.status(401).json({ error: 'Unauthorized' });
      }
    } catch (error) {
      console.error('Error retrieving contacts:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
//========================================//
//   Displaying information to the user   //
//========================================//

const displayContacts = (res, contacts) => {
    if (contacts.status === 'error') {
      res.write(`<p>Unable to retrieve contacts! Error Message: ${contacts.message}</p>`);
      return;
    }
    res.write('<h4>Contact List:</h4>');
    contacts.forEach((contact) => {
      const firstname = contact.properties.firstname ? contact.properties.firstname.value : 'N/A';
      const lastname = contact.properties.lastname ? contact.properties.lastname.value : 'N/A';
      res.write(`<p>Contact name: ${firstname} ${lastname}</p>`);
    });
  };

app.get('/', async (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.write(`<h2>HubSpot OAuth 2.0 Quickstart App</h2>`);

  if (isAuthorized(req.sessionID)) {
    const accessToken = await getAccessToken(req.sessionID);
    const contacts = await getContacts(accessToken);
    res.write(`<h4>Access token: ${accessToken}</h4>`);
    displayContacts(res, contacts);
  } else {
    res.write(`<a href="/install"><h3>Install the app</h3></a>`);
  }
  
  res.end();
});

app.get('/refreshtoken', async(req,res)=>{
  try{
  const accessToken = await getAccessToken(req.sessionID);
  res.json({ accessToken });
  }catch(error){
    console.error('Error retrieving access token:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.use(express.json());
let webhookDealId=[];

app.post('/webhook', async (req, res) => {
    try {
      const accessToken = await getAccessToken(req.sessionID);
      const hubspotClient = new hubspot.Client({ accessToken });
  
      // Log the incoming request body as JSON
      console.log('Received webhook:', JSON.stringify(req.body));
  
      // Extract relevant data from the webhook payload
      const eventData = req.body[0]; // Assuming there's only one event in the payload
      const dealId = eventData.objectId;
      webhookDealId.push(dealId); // Store the dealId
  
      res.sendStatus(200);
    } catch (error) {
      console.error('Error handling webhook:', error);
      res.sendStatus(500);
    }
  });
  
  app.get('/deals', async (req, res) => {
    try {
      const accessToken = await getAccessToken(req.sessionID);
      const hubspotClient = new hubspot.Client({ accessToken });
  
      // Retrieve the deal using the stored dealId
      const deal = await Promise.all(
        webhookDealId.map((dealId) => hubspotClient.crm.deals.basicApi.getById(dealId))
      );
      console.log(JSON.stringify(deal, null, 2));

      // Clear the stored dealId

      const query = `
      INSERT INTO deals (id, amount, closedate, createdate, dealname, dealstage, hs_lastmodifieddate, hs_object_id, pipeline)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    // Generate a new UUID for the id column
    const values = deal.map((deal) => [
        uuidv4(),
        deal.properties.amount,
        deal.properties.closedate,
        deal.properties.createdate,
        deal.properties.dealname,
        deal.properties.dealstage,
        deal.properties.hs_lastmodifieddate,
        deal.properties.hs_object_id,
        deal.properties.pipeline
      ]);


      await Promise.all(
        values.map((dealValues) => pool.query(query, dealValues))
      );

      webhookDealId = [];
  
      // Send the deal data as a JSON response
      res.json(deal);
    } catch (error) {
      console.error('Error retrieving deal:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  


  app.post('/store-pipelines', async (req, res) => {
    const { funnelName, leadPipeline, bdrPipeline, salesPipeline } = req.body;
    console.log(req.body);
  
    // Insert the pipeline data into the "pipelines" table in the database
    try {
      const query = 'INSERT INTO pipelines (lead_pipeline_id, lead_pipeline_name, bdr_pipeline_id, bdr_pipeline_name, sales_pipeline_id, sales_pipeline_name, funnel_name) VALUES ($1, $2, $3, $4, $5, $6, $7)';
      await pool.query(query, [leadPipeline.id, leadPipeline.name, bdrPipeline.id, bdrPipeline.name, salesPipeline.id, salesPipeline.name, funnelName ]);
  
      res.sendStatus(200); // Send success status if the data is stored successfully
    } catch (error) {
      console.error('Error storing pipelines:', error);
      res.sendStatus(500); // Send error status if there is an issue storing the data
    }
  });

  let funnelStages = [];

  app.get('/pipelines-stages', async (req, res) => {
    try {
      const accessToken = await getAccessToken(req.sessionID); // Get the access token dynamically
      const hubspotClient = new hubspot.Client({ accessToken });
      const objectType = "deals";

      const { funnelName } = req.query;

      const query = 'SELECT lead_pipeline_id, bdr_pipeline_id, sales_pipeline_id FROM pipelines WHERE funnel_name = $1';
      const result = await pool.query(query, [funnelName]);
      const pipelineIds = result.rows[0];

      const leadPipelineStages = await hubspotClient.crm.pipelines.pipelineStagesApi.getAll(objectType, pipelineIds.lead_pipeline_id);
      const bdrPipelineStages = await hubspotClient.crm.pipelines.pipelineStagesApi.getAll(objectType, pipelineIds.bdr_pipeline_id);
      const salesPipelineStages = await hubspotClient.crm.pipelines.pipelineStagesApi.getAll(objectType, pipelineIds.sales_pipeline_id);

      const pipelineStagesResponse = await Promise.all([
        leadPipelineStages,
        bdrPipelineStages,
        salesPipelineStages,
      ]);

    const leadStages = pipelineStagesResponse[0].results.map((stage) => stage.id);
    const bdrStages = pipelineStagesResponse[1].results.map((stage) => stage.id);
    const salesStages = pipelineStagesResponse[2].results.map((stage) => stage.id);

    const fullFunnelStages = {
      leadPipelineStages: leadStages,
      bdrPipelineStages: bdrStages,
      salesPipelineStages: salesStages,
    };

    funnelStages = [
      ...leadStages,
      ...bdrStages,
      ...salesStages,
    ];

      res.json({
        fullFunnelStages,
      });

      console.log(funnelStages);

      const conversionRates = await calculateStageConversionRates(funnelStages);
    res.json({ conversionRates });

    } catch (error) {
      console.error('Error retrieving pipelines:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  
  async function getDistinctFunnelNames() {
    try {
      const query = `
        SELECT DISTINCT funnel_name
        FROM pipelines
      `;
      const result = await pool.query(query);
      const funnelNames = result.rows.map((row) => row.funnel_name);
  
      return funnelNames;
    } catch (error) {
      console.error('Error fetching distinct funnel names:', error);
      throw error;
    }
  }
  
  app.get('/funnels', async (req, res) => {
    try {
      const funnelNames = await getDistinctFunnelNames();
      res.json(funnelNames);
    } catch (error) {
      console.error('Error fetching funnel names:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  async function calculateStageConversionRates(funnelStages) {
    try {
      const conversionRates = [];
      console.log(funnelStages);
  
      for (let i = 0; i < funnelStages.length - 1; i++) {
        const sourceStage = funnelStages[i];
        const targetStage = funnelStages[i + 1];
  
        const query = `
          SELECT COUNT(*) AS count
          FROM deals
          WHERE dealstage = $1
        `;
        const sourceStageResult = await pool.query(query, [sourceStage]);
        const sourceStageCount = sourceStageResult.rows[0].count;
  
        const targetStageResult = await pool.query(query, [targetStage]);
        const targetStageCount = targetStageResult.rows[0].count;
  
        // Calculate conversion rate
        const conversionRate = sourceStageCount > 0 ? (targetStageCount / sourceStageCount) * 100 : 0;
  
        const stageConversionRate = {
          sourceStage,
          targetStage,
          conversionRate,
        };
  
        conversionRates.push(stageConversionRate);
      }
  
      return conversionRates;
    } catch (error) {
      console.error('Error calculating stage conversion rate:', error);
      throw error;
    }
  }
  
  
  
  app.get('/conversion-rate', async (req, res) => {
    try {

      

      const conversionRates = await calculateStageConversionRates(funnelStages);
      res.json({ conversionRates });
    } catch (error) {
      console.error('Error calculating conversion rates:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  

app.get('/error', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.write(`<h4>Error: ${req.query.msg}</h4>`);
  res.end();
});


app.listen(PORT, () => console.log(`Server started on Port ${PORT}`));