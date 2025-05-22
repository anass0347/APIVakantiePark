require('dotenv').config();
const express = require('express');
// const fetch = require('node-fetch'); // REMOVED for Node.js v22+
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Kenter API config (use .env for secrets in production)
const KENTER_AUTH_URL = 'https://login.kenter.nu/connect/token';
const KENTER_CONNECTION_ID = '871685900041061903'; // <--  real connectionId
const KENTER_METERING_POINT_ID = '6500110544';      // <--  real meteringPointId
const KENTER_SCOPE = 'meetdata.read';
const KENTER_CLIENT_ID = process.env.KENTER_CLIENT_ID || 'api_10162_9f5a0e';
const KENTER_CLIENT_SECRET = process.env.KENTER_CLIENT_SECRET || 'ZKJ0clJBav63$*ORPxGu02Tc';

let tokenCache = {
  access_token: null,
  expires_at: 0
};

async function getAccessToken() {
  if (tokenCache.access_token && Date.now() < tokenCache.expires_at) {
    return tokenCache.access_token;
  }
  const body = new URLSearchParams({
    client_id: KENTER_CLIENT_ID,
    client_secret: KENTER_CLIENT_SECRET,
    grant_type: 'client_credentials',
    scope: KENTER_SCOPE
  });
  
  console.log('Auth URL:', KENTER_AUTH_URL);
  console.log('Request body:', {
    client_id: KENTER_CLIENT_ID,
    client_secret: '***REDACTED***',
    grant_type: 'client_credentials',
    scope: KENTER_SCOPE
  });

  const res = await fetch(KENTER_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  if (!res.ok) {
    throw new Error('Failed to get Kenter access token');
  }
  const data = await res.json();
  tokenCache.access_token = data.access_token;
  tokenCache.expires_at = Date.now() + (data.expires_in * 1000) - 60000; // 1 min early
  return data.access_token;
}

// Proxy endpoint for usage data
app.get('/api/kenter/usage', async (req, res) => {
  try {
    const { periodType, year, month, day } = req.query;
    if (!periodType || !year || !month || (periodType === 'days' && !day)) {
      return res.status(400).json({ error: 'Missing required query parameters' });
    }
    let endpoint = `https://api.kenter.nu/meetdata/v2/measurements/connections/${KENTER_CONNECTION_ID}/metering-points/${KENTER_METERING_POINT_ID}/${periodType}/${year}`;
    if (periodType === 'days') {
      endpoint += `/${month}/${day}`;
    } else if (periodType === 'months') {
      endpoint += `/${month}`;
    }
    console.log('Request parameters:', { periodType, year, month, day });
    console.log('Full API endpoint:', endpoint);
    
    const token = await getAccessToken();
    console.log('Using bearer token:', token.substring(0, 20) + '...');
    
    const apiRes = await fetch(endpoint, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    console.log('API Response status:', apiRes.status);
    console.log('API Response headers:', Object.fromEntries(apiRes.headers.entries()));
    
    if (!apiRes.ok) {
      const text = await apiRes.text();
      console.error('API Error response:', text);
      return res.status(apiRes.status).json({ error: text });
    }
    
    const data = await apiRes.json();
    console.log('Raw API Response data:', JSON.stringify(data, null, 2));
    
    // Check if we have measurements and their structure
    if (data.measurements) {
      console.log('Number of measurements:', data.measurements.length);
      if (data.measurements.length > 0) {
        console.log('Sample measurement structure:', JSON.stringify(data.measurements[0], null, 2));
      }
    } else {
      console.log('No measurements found in response');
    }
    
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Kenter backend proxy running on port ${PORT}`);
}); 