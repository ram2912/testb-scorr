module.exports = {
  development: {
    port: process.env.PORT || 5001,
    databaseUrl: process.env.DATABASE_URL_DEV,
    clientID: '145b0563-58c0-4d84-b557-6d0c5c2afcbd',
    clientSecret: 'd5006e11-6a22-46e8-b3f9-92c74fa7b929',
    redirectUri: 'https://testback.scorr-app.eu/oauth-callback', // Development redirect URL
    scopes: process.env.SCOPE || 'crm.objects.deals.read',
    corsOrigin: ['https://www.scorr-app.eu', 'https://test.scorr-app.eu'],
    accessTokenCacheExpiry: Math.round((60 * 60) * 0.75),
    frontRedirect: 'https://test.scorr-app.eu/funnel' // 45 minutes (in seconds)
  },
  production: {
    port: process.env.PORT || 5001,
    databaseUrl: process.env.DATABASE_URL_PROD,
    clientID: '94a8188f-5484-474f-b8a4-5eb80fc5d5db',
    clientSecret: 'c7f173fa-411e-480a-b5e9-d90a0c01a385',
    redirectUri: 'https://backend.scorr-app.eu/oauth-callback', // Production redirect URL
    scopes: process.env.SCOPE || 'crm.objects.deals.read',
    corsOrigin: ['https://www.scorr-app.eu', 'https://test.scorr-app.eu'],
    accessTokenCacheExpiry: Math.round((60 * 60) * 0.75),
    frontRedirect: 'https://www.scorr-app.eu/funnel' 
  },
};

  