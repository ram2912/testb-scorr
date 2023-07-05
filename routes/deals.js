const express = require('express');
const router = express.Router();

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
  
  router.get('/pipelines', async (req, res) => {
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
  
  router.get('/pipelines2', async (req, res) => {
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
  
  
  router.get('/pipelinestage', async (req, res) => {
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
  
  
  
  
    
  
 router.get('/contacts', async (req, res) => {
   
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
  
  router.get('/', async (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.write(`<h2>Install SCORR APP</h2>`);
  
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
  
  router.get('/refreshtoken', async(req,res)=>{
    try{
    const accessToken = await getAccessToken(req.sessionID);
    res.json({ accessToken });
    }catch(error){
      console.error('Error retrieving access token:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
router.use(express.json());
  let webhookDealId=[];
  
  router.post('/webhook', async (req, res) => {
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
  
router.get('/pipelines-names', async (req, res) => {
      try {
        const { funnelName } = req.query;
        const pipelineNames = await getPipelines(funnelName);
        res.json(pipelineNames);
      } catch (error) {
        console.error('Error fetching pipeline names:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });
  
    router.get('/deal-properties', async (req, res) => {
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
  
    router.post('/store-pipelines', async (req, res) => {
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
  
  router.get('/pipelines-stages', async (req, res) => {
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
    
    router.get('/funnels', async (req, res) => {
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
  
  
  module.exports = router;