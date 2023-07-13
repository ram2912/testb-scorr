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
const router = express.Router();

const { getAccessTokenFromStorage, getAccessToken } = require('./routes/hs_auth');
const { verifyToken } = require('./routes/users');
const environment = process.env.NODE_ENV || 'development';
const environmentConfig = config[environment];


const authRouter = require('./routes/hs_auth.js');
const extractRouter = require('./routes/data_extract.js');
const userRouter = require('./routes/users.js');


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



  app.use(bodyParser.json());

  app.use('/auth', authRouter.router);
  app.use('/extract', extractRouter.router);
  app.use('/users', userRouter.router);
  
  app.use('/protected', verifyToken);

  app.get('/protected', (req, res) => {
    try{
      return res.json({ message: 'You are authorized' });
    } catch (error) {
      console.error('Error during signup:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });





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








app.use(express.json());
let webhookDealId=[];

app.post('/webhook', async (req, res) => {
    try {
      const accessTokenPromise = getAccessTokenFromStorage(); // Get the access token as a Promise
      const accessToken = await accessTokenPromise;  // Get the access token dynamically
      console.log(accessToken);
      const hubspotClient = new hubspot.Client({ accessToken });
  
      // Log the incoming request body as JSON
      console.log('Received webhook:', JSON.stringify(req.body));
  
      // Extract relevant data from the webhook payload
      const eventData = req.body[0]; // Assuming there's only one event in the payload
      const dealId = eventData.objectId;
      const deal = await hubspotClient.crm.deals.basicApi.getById(dealId);
      console.log(JSON.stringify(deal, null, 2));
  
      // Store the deal properties in the database
      const query = `
        INSERT INTO deals (id, amount, closedate, createdate, dealname, dealstage, hs_lastmodifieddate, hs_object_id, pipeline)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;
  
      const values = [
        uuidv4(),
        deal.properties.amount,
        deal.properties.closedate,
        deal.properties.createdate,
        deal.properties.dealname,
        deal.properties.dealstage,
        deal.properties.hs_lastmodifieddate,
        deal.properties.hs_object_id,
        deal.properties.pipeline
      ];
  
      await pool.query(query, values);
  
      res.sendStatus(200);
    } catch (error) {
      console.error('Error handling webhook:', error);
      res.sendStatus(500);
    }
  });

  const getPipelines = async (funnelName) => {
    
    try{
    const query = 'SELECT lead_pipeline_name, bdr_pipeline_name, sales_pipeline_name FROM pipelines WHERE funnel_name = $1';
    const result = await pool.query(query, [funnelName]);
    console.log(result.rows[0]);
    const pipelineNames = result.rows[0];
    console.log(pipelineNames.lead_pipeline_name);
    console.log(pipelineNames.bdr_pipeline_name);
    console.log(pipelineNames.sales_pipeline_name);
    return pipelineNames;
    }catch(error){
      console.error('Error fetching pipeline names:', error);
      return null;
    }
  };

  app.get('/pipelines-names', async (req, res) => {
    try {
      const { funnelName } = req.query;
      const pipelineNames = await getPipelines(funnelName);
      res.json(pipelineNames);
    } catch (error) {
      console.error('Error fetching pipeline names:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/deal-properties', async (req, res) => {
    try {
      const accessTokenPromise = getAccessTokenFromStorage(); // Get the access token as a Promise
      const accessToken = await accessTokenPromise;  // Get the access token dynamically
      console.log(accessToken);
      const hubspotClient = new hubspot.Client({ accessToken });
   
      const deal1 = await hubspotClient.crm.deals.basicApi.getById("7753776094");

      console.log(JSON.stringify(deal1, null, 2));

      res.json(deal1);
    } catch (error) {
      console.error('Error retrieving deal:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

      // Retrieve the properties for the specified dealID

  app.post('/store-pipelines', async (req, res) => {
    const { funnelName, leadPipeline, bdrPipeline, salesPipeline} = req.body; // Insert the pipeline data into the "pipelines" table in the database
    try {
      const accessTokenPromise = getAccessTokenFromStorage(); // Get the access token as a Promise
      const accessToken = await accessTokenPromise;  // Get the access token dynamically
      console.log(accessToken);// Get the access token dynamically

    const { userId, userEmail, hubDomain } = await getUserId(accessToken);
    console.log(req.body);
    console.log('Email: ', userEmail);
    console.log('Hub Domain: ', hubDomain);
    console.log('User ID: ', userId);

    const id = await getUserIdByEmail(userEmail, hubDomain);
      const query = 'INSERT INTO pipelines (lead_pipeline_id, lead_pipeline_name, bdr_pipeline_id, bdr_pipeline_name, sales_pipeline_id, sales_pipeline_name, funnel_name, user_Id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)';
      await pool.query(query, [leadPipeline.id, leadPipeline.name, bdrPipeline.id, bdrPipeline.name, salesPipeline.id, salesPipeline.name, funnelName, id ]);
  
      res.sendStatus(200); // Send success status if the data is stored successfully
    } catch (error) {
      console.error('Error storing pipelines:', error);
      res.sendStatus(500); // Send error status if there is an issue storing the data
    }
  });

  let funnelStages = [];

app.get('/pipelines-stages', async (req, res) => {
  try {
    const accessTokenPromise = getAccessTokenFromStorage(); // Get the access token as a Promise
    const accessToken = await accessTokenPromise;  // Get the access token dynamically
    console.log(accessToken);
    const hubspotClient = new hubspot.Client({ accessToken });
    const objectType = "deals";

    const { funnelName } = req.query;

    const query = 'SELECT lead_pipeline_id, bdr_pipeline_id, sales_pipeline_id FROM pipelines WHERE funnel_name = $1';
    const result = await pool.query(query, [funnelName]);
    const pipelineIds = result.rows[0];
    console.log(pipelineIds.lead_pipeline_id);
    console.log(pipelineIds.bdr_pipeline_id);
    console.log(pipelineIds.sales_pipeline_id);

    const pipelinePromises = [];

    if (pipelineIds.lead_pipeline_id) {
      const leadPipelineStages = await hubspotClient.crm.pipelines.pipelineStagesApi.getAll(objectType, pipelineIds.lead_pipeline_id);
      const leadPipelineStagesWithoutLast = leadPipelineStages.results.slice(0, -1);
      pipelinePromises.push(leadPipelineStagesWithoutLast);
    }
  
    if (pipelineIds.bdr_pipeline_id) {
      const bdrPipelineStages = await hubspotClient.crm.pipelines.pipelineStagesApi.getAll(objectType, pipelineIds.bdr_pipeline_id);
      const bdrPipelineStagesWithoutLast = bdrPipelineStages.results.slice(0, -1);
      pipelinePromises.push(bdrPipelineStagesWithoutLast);
    }
  
    if (pipelineIds.sales_pipeline_id) {
      const salesPipelineStages = await hubspotClient.crm.pipelines.pipelineStagesApi.getAll(objectType, pipelineIds.sales_pipeline_id);
      const salesPipelineStagesWithoutLast = salesPipelineStages.results.slice(0, -1);
      pipelinePromises.push(salesPipelineStagesWithoutLast);
    }

    console.log('Pipeline Promise: ',pipelinePromises);

    const pipelineStagesResponse = await Promise.all(pipelinePromises);
    console.log('pipelineStagesResponse: ',pipelineStagesResponse);

    const pipelineStages = pipelineStagesResponse.flat();


    console.log('Pipeline Stages: ', pipelineStages);

   funnelStages = pipelineStages.map((stage) => ({
      id: stage.id,
      name: stage.label,
    }));

    res.json({
      funnelStages,
    });

    console.log('FunnelStages: ',funnelStages);


  } catch (error) {
    console.error('Error retrieving pipelines:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


  
  async function getDistinctFunnelNames(userId) {
    try {
      const query = `
        SELECT DISTINCT funnel_name
        FROM pipelines
        WHERE user_id = $1
      `;
      const result = await pool.query(query, [userId]);
      const funnelNames = result.rows.map((row) => row.funnel_name);
  
      return funnelNames;
    } catch (error) {
      console.error('Error fetching distinct funnel names:', error);
      throw error;
    }
  }
  
  app.get('/funnels', async (req, res) => {
    try {
      const accessTokenPromise = getAccessTokenFromStorage(); // Get the access token as a Promise
      const accessToken = await accessTokenPromise;  // Get the access token dynamically
      console.log(accessToken);

      const { userId, userEmail, hubDomain } = await getUserId(accessToken);
    console.log(req.body);
    console.log('Email: ', userEmail);
    console.log('Hub Domain: ', hubDomain);
    console.log('User ID: ', userId);

    const id = await getUserIdByEmail(userEmail, hubDomain);

      
      const funnelNames = await getDistinctFunnelNames(id);
      res.json(funnelNames);
    } catch (error) {
      console.error('Error fetching funnel names:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });


  async function calculateStageConversionRates(funnelStages) {
    try {
      console.log('Funnel stages for cvr:', funnelStages)
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

        console.log('Stage Conversion Rate: ',stageConversionRate);
  
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
      console.log('Funnel stages for cvr in:', funnelStages)

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