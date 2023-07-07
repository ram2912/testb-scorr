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
const { Configuration, OpenAIApi } = require('openai');
const { env } = require('process');
const config = require('../config-test');
const { getAccessTokenFromStorage } = require('../routes/hs_auth');
const url = require('url');
const { PythonShell } = require('python-shell');
const router = express.Router();

const environment = process.env.NODE_ENV || 'development';
const environmentConfig = config[environment];

let propertyNames = [];
let propertyLabels = {};

router.get('/deal-properties', async (req, res) => {
  try {
    const accessTokenPromise = getAccessTokenFromStorage();
    const accessToken = await accessTokenPromise;
    console.log(accessToken);
    const hubspotClient = new hubspot.Client({ accessToken });

    const objectType = 'deal';
    const archived = false;
    const properties = undefined;

    const dealPropertiesResponse = await hubspotClient.crm.properties.coreApi.getAll(
      objectType,
      archived,
      properties
    );
    const dealProperties = dealPropertiesResponse.results;
    propertyNames = dealProperties.map((property) => property.name);
    propertyLabels = dealProperties.reduce((labels, property) => {
      labels[property.name] = property.label;
      return labels;
    }, {});

    console.log(`Retrieved ${dealProperties.length} properties`);

    res.json({ propertyNames, propertyLabels });
  } catch (error) {
    console.error('Error retrieving deal:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

let cleanedDeals = [];

router.get('/all-deals', async (req, res) => {
  try {
    const accessTokenPromise = getAccessTokenFromStorage();
    const accessToken = await accessTokenPromise;
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

      const filteredDeals = results.filter((deal) => new Date(deal.createdAt) > new Date('2022-10-01'));

      allDeals.push(...filteredDeals);

      if (paging && paging.next && paging.next.link) {
        const nextPageUrl = new URL(paging.next.link);
        after = nextPageUrl.searchParams.get('after');
      } else {
        break; // No more pages, exit the loop
      }
    }

    console.log(`Retrieved ${allDeals.length} deals`);

    const dealsAfterOct2022 = allDeals.filter((deal) => new Date(deal.createdAt) > new Date('2022-10-01'));


    // Get all unique property names
    const uniquePropertyNames = Array.from(
      new Set(dealsAfterOct2022.flatMap((deal) => Object.keys(deal.properties)))
    );

    // Iterate over each property and filter out the properties with more null values
   

    

    // Remove properties with more null values from each deal and convert labels to properties
    // Remove properties with more null values from each deal and convert labels to properties
cleanedDeals = dealsAfterOct2022.map((deal) => {
    const cleanedPropertiesData = {};
    uniquePropertyNames.forEach((propertyName) => {
      cleanedPropertiesData[propertyLabels[propertyName]] = deal.properties[propertyName];
    });
    return {
      id: deal.id,
      properties: cleanedPropertiesData,
      createdAt: deal.createdAt,
      updatedAt: deal.updatedAt,
      archived: deal.archived
    };
  });
  

    res.json(cleanedDeals);
  } catch (error) {
    console.error('Error retrieving deals:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/deals', async (req, res) => {
    try {
        res.json(cleanedDeals);
        } catch (error) {
            console.error('Error retrieving deals:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
});

router.get('/clean-data', (req, res) => {
    try {
    // Filter out columns with more than 50% null values
    const uniquePropertyNames = Array.from(
        new Set(cleanedDeals.flatMap((deal) => Object.keys(deal.properties)))
      );
  
      // Iterate over each property and filter out the properties with more null values
      const cleanedProperties = uniquePropertyNames.filter((propertyName) => {
        const nullCount = dealsAfterOct2022.reduce((count, deal) => {
          return count + (deal.properties[propertyName] === null ? 1 : 0);
        }, 0);
  
        const nullPercentage = nullCount / dealCount;
        return nullPercentage < threshold;
      });
  
      
  
      // Remove properties with more null values from each deal and convert labels to properties
      const cleanedDeals1 = cleanedDeals.map((deal) => {
        const cleanedPropertiesData = {};
        cleanedProperties.forEach((propertyName) => {
          cleanedPropertiesData[propertyLabels[propertyName]] = deal.properties[propertyName];
        });
        return {
          id: deal.id,
          properties: cleanedPropertiesData,
          createdAt: deal.createdAt,
          updatedAt: deal.updatedAt,
          archived: deal.archived
        };
      });

      cleanedDeals = cleanedDeals1;
  
      res.json(cleanedDeals);
  } catch (error) {
    console.error('Error retrieving deals:', error);
    res.status(500).json({ error: 'Internal Server Error' });
    }
});

  
  

module.exports = {
  router,
};






