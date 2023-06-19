module.exports = {
  development: {
    port: process.env.PORT || 5001,
    databaseUrl: process.env.DATABASE_URL_DEV || 'postgres://cryrlxnrpclgau:7e3b9e9b0ce4910a6dfbbeeedb4994716581629132920e0ef972dafadd5ec868@ec2-54-155-46-64.eu-west-1.compute.amazonaws.com:5432/db9vfhgis0raq2',
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
    databaseUrl: process.env.DATABASE_URL_PROD || 'postgres://ksiylctkoefqre:e077a2fb2e2c860777f4bf2422b1569c39bd2923c8a98ba09d7a42f6cff6083b@ec2-3-233-174-23.compute-1.amazonaws.com:5432/de3s5ps0bvjcj4',
    clientID: '94a8188f-5484-474f-b8a4-5eb80fc5d5db',
    clientSecret: 'c7f173fa-411e-480a-b5e9-d90a0c01a385',
    redirectUri: 'https://backend.scorr-app.eu/oauth-callback', // Production redirect URL
    scopes: process.env.SCOPE || 'crm.objects.deals.read',
    corsOrigin: ['https://www.scorr-app.eu', 'https://test.scorr-app.eu'],
    accessTokenCacheExpiry: Math.round((60 * 60) * 0.75),
    frontRedirect: 'https://www.scorr-app.eu/funnel' 
  },
};
