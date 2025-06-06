require('dotenv').config();
const express = require('express');
// const fetch = require('node-fetch'); // REMOVED for Node.js v22+
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Add caching middleware
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

// Cache middleware
function cacheMiddleware(duration) {
  return (req, res, next) => {
    const key = req.originalUrl;
    const cachedResponse = cache.get(key);
    
    if (cachedResponse && Date.now() - cachedResponse.timestamp < duration) {
      return res.json(cachedResponse.data);
    }
    
    res.sendResponse = res.json;
    res.json = (body) => {
      cache.set(key, {
        timestamp: Date.now(),
        data: body
      });
      res.sendResponse(body);
    };
    next();
  };
}

// Apply cache middleware to the usage endpoint
app.use('/api/kenter/usage', cacheMiddleware(CACHE_DURATION));

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

// Helper function to convert timestamp to readable format
function convertTimestamp(timestamp) {
  if (!timestamp) return null;
  // If timestamp is in seconds, convert to milliseconds
  if (timestamp < 1000000000000) { // crude check: less than year 33658 in ms
    timestamp = timestamp * 1000;
  }
  const date = new Date(timestamp);
  return date.toLocaleString('nl-NL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

// Helper function to aggregate measurements
function aggregateMeasurements(measurements) {
  if (!measurements || !Array.isArray(measurements)) return [];
  
  // Group measurements by hour
  const hourlyData = measurements.reduce((acc, measurement) => {
    const date = new Date(measurement.timestamp);
    const hourKey = date.toISOString().slice(0, 13); // YYYY-MM-DDTHH
    
    if (!acc[hourKey]) {
      acc[hourKey] = {
        timestamp: convertTimestamp(measurement.timestamp),
        values: [],
        count: 0
      };
    }
    
    // Only keep essential fields
    const essentialData = {
      value: measurement.value,
      unit: measurement.unit,
      type: measurement.type
    };
    
    acc[hourKey].values.push(essentialData);
    acc[hourKey].count++;
    
    return acc;
  }, {});
  
  // Calculate averages and format the data
  return Object.values(hourlyData).map(hour => ({
    timestamp: hour.timestamp,
    averageValue: hour.values.reduce((sum, v) => sum + v.value, 0) / hour.count,
    unit: hour.values[0].unit,
    type: hour.values[0].type,
    measurementCount: hour.count
  }));
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
    
    // Convert every timestamp in every nested Measurements array to a human-readable string, but keep the original timestamp as well
    if (Array.isArray(data)) {
      data.forEach(channel => {
        if (channel.Measurements && Array.isArray(channel.Measurements)) {
          channel.Measurements.forEach(measurement => {
            if (measurement.timestamp) {
              const converted = convertTimestamp(measurement.timestamp);
              console.log('Converted timestamp:', converted);
              measurement.timestamp_readable = converted;
            }
          });
        }
      });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to clear the backend cache via GET request
app.get('/api/kenter/clear-cache', (req, res) => {
  cache.clear();
  res.json({ message: 'Cache cleared' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Kenter backend proxy running on port ${PORT}`);
}); 

