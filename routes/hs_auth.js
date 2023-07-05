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


const router = express.Router();   

const environment = process.env.NODE_ENV || 'development';
const environmentConfig = config[environment];




const refreshTokenStore = {};
const accessTokenCache = new NodeCache({ deleteOnExpire: true });

const CLIENT_ID = environmentConfig.clientID;
const CLIENT_SECRET = environmentConfig.clientSecret;

PORT = process.env.PORT || 5001;

// Scopes for this app will default to `crm.objects.contacts.read`
// To request others, set the SCOPE environment variable instead
const SCOPES = ['crm.objects.deals.read'];


if (process.env.SCOPE) {
    SCOPES = (process.env.SCOPE.split(/ |, ?|%20/)).join(' ');
}

// On successful install, users will be redirected to /oauth-callback
const REDIRECT_URI = environmentConfig.redirectUri;

//===========================================================================//

// Use a session to keep track of client ID
router.use(session({
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
router.get('/install', (req, res) => {
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

const frontRedirect = environmentConfig.frontRedirect;

router.get('/oauth-callback', async (req, res) => {
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
    const tokens = await exchangeForTokens(authCodeProof,req.sessionID);
    console.log(req.sessionID);
    if (tokens.message) {
      return res.redirect(`/error?msg=${tokens.message}`);
    }

    console.log(tokens);
    // Once the tokens have been retrieved, use them to make a query
    // to the HubSpot API
    
    res.redirect(frontRedirect);
  }
});

//==========================================//
//   Exchanging Proof for an Access Token   //
//==========================================//

const exchangeForTokens = async (exchangeProof,userId) => {
  try {
    console.log('       > Exchanging proof for access token');
    console.log('       > Request data:', exchangeProof);
    const responseBody = await request.post('https://api.hubapi.com/oauth/v1/token', {
      form: exchangeProof
    });
    // Usually, this token data should be persisted in a database and associated with
    // a user identity.
    const tokens = JSON.parse(responseBody);
    console.log(tokens);

    await storeAccessToken(tokens.access_token, tokens.refresh_token);
    await getUserId(tokens.access_token);

    refreshTokenStore[userId] = tokens.refresh_token;
    accessTokenCache.set(userId, tokens.access_token, Math.round(tokens.expires_in * 0.75));

    console.log('       > Received an access token and refresh token');

    return tokens;
  } catch (e) {
    console.error(`       > Error exchanging ${exchangeProof.grant_type} for access token`);
    return JSON.parse(e.response.body);
  }
};

const storeAccessToken = async (accessToken, refreshToken) => {
  const query = 'INSERT INTO access_tokens (access_token, refresh_token) VALUES ($1, $2)';
  const values = [accessToken, refreshToken];

  try {
    await pool.query(query, values);
    
    console.log('Access token stored successfully');
  } catch (error) {
    console.error('Error storing access token:', error);
  }
};

const getAccessTokenFromStorage = async () => {
  const query = 'SELECT access_token FROM access_tokens ORDER BY id DESC LIMIT 1';

  try {
    const result = await pool.query(query);
    if (result.rows.length > 0) {
      const accessToken = result.rows[0].access_token; // Corrected column name
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


const getRefreshTokenFromStorage = async () => {
  const query = 'SELECT refresh_token FROM access_tokens ORDER BY id DESC LIMIT 1';

  try {
    const result = await pool.query(query);
    if (result.rows.length > 0) {
      const refreshToken = result.rows[0].refresh_token;
      console.log('Refresh token retrieved successfully');
      return refreshToken;
    } else {
      console.log('No refresh token found in the database');
      return null;
    }
  } catch (error) {
    console.error('Error retrieving refresh token:', error);
    return null;
  }
};

const refreshAccessToken = async () => {

  refreshToken = await getRefreshTokenFromStorage();
  console.log(refreshToken);

  const refreshTokenProof = {
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    refresh_token: refreshToken
  };
  const tokens = await exchangeForTokens(refreshTokenProof);
  if (tokens.message) {
    console.error('Error refreshing access token:', tokens.message);
  } else {
    const { access_token, refresh_token } = tokens;
    await storeAccessToken(access_token, refresh_token);
    console.log('Access token refreshed successfully');
  }
};

const getAccessToken = async () => {
  let accessToken = accessTokenCache.get('access_token');

  if (!accessToken) {
    accessToken = await getAccessTokenFromStorage();

    // Store the retrieved access token in the cache
    
    console.log('Got access token from storage');
  }

  // Check if the access token is expired
  const isExpired = await isAccessTokenExpired(accessToken);
  if (isExpired) {
    console.log('Access token is expired');
    await refreshAccessToken();
    accessToken = await getAccessTokenFromStorage();
    
    console.log('Access token refreshed, new access token:', accessToken);
  }
  accessTokenCache.set('access_token', accessToken);

  return accessToken;
};

const getUserId = async (accessToken) => {
  try {
    // Make an API call to check the access token's expiration status
    const response = await request.get(`https://api.hubapi.com/oauth/v1/access-tokens/${accessToken}`);

    const responseBody = JSON.parse(response);
    const userId = responseBody.user_id;
    const userEmail = responseBody.user;
    const hubDomain = responseBody.hub_domain;

    console.log('User ID:', userId);
    console.log('User:', userEmail);
    console.log('Hub Domain:', hubDomain);

    await storeUsers(userId, userEmail, hubDomain);
    
    return { userId, userEmail, hubDomain };
  } catch (error) {
    console.error('Error accessing userId', error);
    return null;
  }
};

const getUserIdByEmail = async (email, hubDomain) => {
  try {
    const query = 'SELECT id FROM users WHERE user_email = $1 AND hub_domain = $2';
    const result = await pool.query(query, [email, hubDomain]);
    const user = result.rows[0];
    return user ? user.id : null;
  } catch (error) {
    console.error('Error retrieving user ID:', error);
    return null;
  }
};



const isAccessTokenExpired = async (accessToken) => {
  try {
    console.log(accessToken)
    // Make an API call to check the access token's expiration status
    const response = await request.get(`https://api.hubapi.com/oauth/v1/access-tokens/${accessToken}`);
    
    console.log('Response body:', response);
    
    const responseBody = JSON.parse(response);
    const expiresIn = responseBody.expires_in;


    
    // Get the expiration timestamp from the token info
    const currentTime = Math.floor(Date.now() / 1000); // Convert to seconds
    const expirationTimestamp = expiresIn + currentTime;
    
    // Compare the expiration timestamp with the current time
    return expirationTimestamp <= currentTime;
  } catch (error) {
    console.error('Error checking access token expiration:', error);
    return true; // Treat as non-expired if an error occurs
  }
};

const interval = 5 * 60 * 1000; // 5 minutes in milliseconds

// Start the periodic task
const task = setInterval(checkAccessTokenExpiration, interval);

// Function to check access token expiration and refresh if necessary
async function checkAccessTokenExpiration() {
  const accessToken = await getAccessToken();
  await isAccessTokenExpired(accessToken);
  
}

// Function to stop the periodic task (if needed)
function stopTask() {
  clearInterval(task);
}


const storeUsers = async (userId, user, hubDomain) => {
  const checkUserQuery = 'SELECT COUNT(*) FROM users WHERE hub_domain = $1 AND user_email = $2';
  const insertUserQuery = 'INSERT INTO users (user_id, user_email, hub_domain) VALUES ($1, $2, $3)';
  const values = [userId, user, hubDomain];

  try {
    const result = await pool.query(checkUserQuery, [hubDomain, user]);
    const count = parseInt(result.rows[0].count);

    if (count === 0) {
      await pool.query(insertUserQuery, values);
      console.log('User ID and email stored successfully');
    } else {
      console.log('User with the same hubDomain and user email already exists. Skipping insertion.');
    }
  } catch (error) {
    console.error('Error storing user ID and email:', error);
  }
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

module.exports = {
    router,
    getAccessToken,
    getUserId,
    getUserIdByEmail,
    isAuthorized,
    getAccessTokenFromStorage
    
}

