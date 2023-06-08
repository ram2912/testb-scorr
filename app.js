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


app.use(cors({
  origin: ['https://www.scorr-app.eu','http://localhost:3000', 'https://test.scorr-app.eu'],
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

const CLIENT_ID = '145b0563-58c0-4d84-b557-6d0c5c2afcbd';
const CLIENT_SECRET = 'd5006e11-6a22-46e8-b3f9-92c74fa7b929';

PORT = process.env.PORT || 5001;

// Scopes for this app will default to `crm.objects.contacts.read`
// To request others, set the SCOPE environment variable instead
const SCOPES = 'crm.objects.deals.read';

if (process.env.SCOPE) {
    SCOPES = (process.env.SCOPE.split(/ |, ?|%20/)).join(' ');
}

// On successful install, users will be redirected to /oauth-callback
const REDIRECT_URI = `https://testback.scorr-app.eu/oauth-callback`;

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
    const token = await exchangeForTokens(authCodeProof);
    if (token.message) {
      return res.redirect(`/error?msg=${token.message}`);
    }

    storeAccessToken(token.access_token);

    // Once the tokens have been retrieved, use them to make a query
    // to the HubSpot API
    
    res.redirect(`https://test.scorr-app.eu/funnel`);
  }
});

//==========================================//
//   Exchanging Proof for an Access Token   //
//==========================================//

const exchangeForTokens = async (exchangeProof, userId) => {
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

const storeAccessToken = async (accessToken) => {
  const query = 'INSERT INTO access_tokens (token) VALUES ($1)';
  const values = [accessToken];

  try {
    await pool.query(query, values);
    console.log('Access token stored successfully');
  } catch (error) {
    console.error('Error storing access token:', error);
  }
};

const getAccessTokenFromStorage = async () => {
  const query = 'SELECT token FROM access_tokens ORDER BY id DESC LIMIT 1';

  try {
    const result = await pool.query(query);
    if (result.rows.length > 0) {
      const accessToken = result.rows[0].token;
      console.log('Access token retrieved successfully');
      return accessToken;
    } else {
      console.log('No access token found in the database');
      return null;
    }
  } catch (error) {
    console.error('Error retrieving access token:', error);
    return null;
  }
};


const refreshAccessToken = async () => {
  const refreshTokenProof = {
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    refresh_token: refreshTokenStore[userId]
  };
  const token = await exchangeForTokens(refreshTokenProof);
  if (token.message) {
    // Handle the error case
  } else {
    storeAccessToken(token.access_token);
  }
};

const getAccessToken = async () => {
  let accessToken = accessTokenCache.get('access_token');

  if (!accessToken) {
    accessToken = await getAccessTokenFromStorage();

    // Store the retrieved access token in the cache
    accessTokenCache.set('access_token', accessToken, expirationTime);
  }

  return accessToken;
};


const isAuthorized = (userId) => {
  return refreshTokenStore[userId] ? true : false;
};

app.get('/authorization-status', (req, res) => {
  const isAuthorized = refreshTokenStore[req.sessionID] ? true : false;

  if (isAuthorized) {
    res.status(200).json({ status: 'authorized' });
  } else {
    res.status(401).json({ status: 'unauthorized' });
  }
});

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
      const accessToken = await getAccessToken();// Get the access token dynamically
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

  app.get('/deal-properties', async (req, res) => {
    try {
      const accessToken = await getAccessToken(req.sessionID); // Get the access token dynamically
      const hubspotClient = new hubspot.Client({ accessToken });
   
      const deal1 = await hubspotClient.crm.deals.basicApi.getById("7754740725");

      console.log(JSON.stringify(deal1, null, 2));

      res.json(deal1);
    } catch (error) {
      console.error('Error retrieving deal:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

      // Retrieve the properties for the specified dealID


  
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
      console.log(pipelineIds.lead_pipeline_id);
      console.log(pipelineIds.bdr_pipeline_id);
      console.log(pipelineIds.sales_pipeline_id);

      const leadPipelineStages = await hubspotClient.crm.pipelines.pipelineStagesApi.getAll(objectType, pipelineIds.lead_pipeline_id);
      const bdrPipelineStages = await hubspotClient.crm.pipelines.pipelineStagesApi.getAll(objectType, pipelineIds.bdr_pipeline_id);
      const salesPipelineStages = await hubspotClient.crm.pipelines.pipelineStagesApi.getAll(objectType, pipelineIds.sales_pipeline_id);

      console.log(leadPipelineStages);
      console.log(bdrPipelineStages);
      console.log(salesPipelineStages);

      
      const pipelineStagesResponse = await Promise.all([
        leadPipelineStages,
        bdrPipelineStages,
        salesPipelineStages,
      ]);

      console.log(pipelineStagesResponse);

      const leadStages = pipelineStagesResponse[0].results.map((stage) => ({
        id: stage.id,
        name: stage.label,
      }));
      const bdrStages = pipelineStagesResponse[1].results.map((stage) => ({
        id: stage.id,
        name: stage.label,
      }));
      const salesStages = pipelineStagesResponse[2].results.map((stage) => ({
        id: stage.id,
        name: stage.label,
      }));

    const fullFunnelStages = {
      salesPipelineStages: salesStages,
      bdrPipelineStages: bdrStages,
      leadPipelineStages: leadStages,
     
    };



    funnelStages = [
      ...leadStages.slice(0, -1),
      ...bdrStages.slice(0, -1),
      ...salesStages.slice(0, -1),
    ];
    

      res.json({
        fullFunnelStages,
      });

      console.log(funnelStages);

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

  async function getSuggestedColumns() {
    try {
      const configuration = new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
      });
      const openai = new OpenAIApi(configuration);
      const prompt1 = `You are a revenue operator and responsible for finding insights on how your stages are performing, especially what is the trend in conversion rate. You are using a stage conversion rate funnel table with columns source stage, target stage, and conversion rates. You need to add two more columns to get a better understanding of the data in the table. Select two columns which suit the requirements the best from this dataset:
  
      Conversion rate trend
      Conversion rate change
      Status
      Reason
      Average time in stage
  
      Give your response by stating the two best columns out of these five. Response format: "Answer: <column1> and <column2>" \n\nA:`;
  
      const response = await openai.createCompletion({
        model: "text-davinci-003",
        prompt: prompt1,
        max_tokens: 100,
        temperature: 0.7,
      });
  
      const suggestedColumnsText = response.data.choices[0].text;
      const suggestedColumns = suggestedColumnsText
        .replace('Answer:', '') // Remove the "Answer:" prefix
        .trim() // Remove leading/trailing whitespaces
        .split(' and ') // Split the columns by "and"
        .map(column => column.trim()) // Trim each column
        .map(column => column.replace(/[^\w\s]/g, '').trim());
  
      return suggestedColumns;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
  
  
  

  // Define the route to test the getSuggestedColumns function
  app.get('/suggested-columns', async (req, res) => {
    try {
      const suggestedColumns = await getSuggestedColumns();
      res.json({ suggestedColumns });
    } catch (error) {
      res.status(500).json({ error: 'An error occurred' });
    }
  });

  async function generateConversionRateStatusAndReason(conversionRates) {
    try {
      const configuration = new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
      });
      const openai = new OpenAIApi(configuration);
  
      const results = [];
  
      const maxRetries = 5; // Maximum number of retries
      const baseDelay = 30000; // Base delay in milliseconds
  
      for (const conversionRate of conversionRates) {
        const { sourceStage, targetStage, conversionRate: rate } = conversionRate;
  
        const prompt = `Given the conversion rate ${rate} from stage "${sourceStage.name}" to stage "${targetStage.name}", determine the status and reason for this conversion rate.\n\nConversion rate: ${rate}\nSource Stage: "${sourceStage.name}"\nTarget Stage: "${targetStage.name}"\nStatus:`;
  
        let status = '';
        let retries = 0;
        let delay = baseDelay;
  
        while (!status && retries <= maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
  
          try {
            const response = await openai.createCompletion({
              model: 'text-davinci-003',
              prompt: prompt,
              max_tokens: 100,
              temperature: 0.7,
            });
  
            status = response.data.choices[0].text.trim();
          } catch (error) {
            if (error.response && error.response.status === 429) {
              // Rate limit error, handle appropriately
              console.log('Rate limit exceeded. Waiting before retrying...');
              retries++;
              delay *= 2; // Exponential backoff delay
            } else {
              // Other error occurred, handle appropriately
              console.error(error);
              throw error;
            }
          }
        }
  
        // Generate reason based on the status and stages
        let reason = '';
        if (status === 'High') {
          reason = `The conversion rate from stage "${sourceStage.name}" to stage "${targetStage.name}" is high due to effective strategies and optimized processes.`;
        } else if (status === 'Low') {
          reason = `The conversion rate from stage "${sourceStage.name}" to stage "${targetStage.name}" is low due to various factors such as poor user experience and inadequate marketing efforts.`;
        } else {
          reason = `The conversion rate from stage "${sourceStage.name}" to stage "${targetStage.name}" is at an average level with room for improvement.`;
        }
  
        const result = {
          ...conversionRate,
          status: status,
          reason: reason,
        };
  
        results.push(result);
      }
  
      return results;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
  

  app.get('/conversion-rate-status-and-reason', async (req, res) => {
    try {
      const conversionRates = await calculateStageConversionRates(funnelStages);
      const conversionRatesWithStatusAndReason = await generateConversionRateStatusAndReason(conversionRates);
      res.json({ conversionRatesWithStatusAndReason });
    } catch (error) {
      console.error('Error calculating conversion rates:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  
  

  async function calculateStageConversionRates(funnelStages) {
    try {
      const conversionRates = [];
  
      for (let i = 0; i < funnelStages.length - 1; i++) {
        const sourceStage = funnelStages[i].id;
        const targetStage = funnelStages[i + 1].id;
  
        const sourceStageName = funnelStages[i].name;
        const targetStageName = funnelStages[i + 1].name;
  
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
          sourceStage: {
            id: sourceStage,
            name: sourceStageName,
          },
          targetStage: {
            id: targetStage,
            name: targetStageName,
          },
          conversionRate: conversionRate > 100 ? "Invalid data" : conversionRate.toFixed(0),
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