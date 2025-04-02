require('dotenv').config();
const { MongoClient } = require('mongodb');
const axios = require('axios');

const API_URL = 'http://178.231.21.67/api/v1/data';
const INTERVAL = 15 * 60 * 1000; // 15 minutes in milliseconds

async function fetchHomeWizardData() {
    try {
        const response = await axios.get(API_URL);
        return {
            timestamp: new Date().toISOString(),
            verbruik: response.data.total_power_import_kwh,
            opwekking: response.data.total_power_export_kwh
        };
    } catch (error) {
        console.error('Error fetching HomeWizard data:', error.message);
        throw error;
    }
}

async function uploadToMongoDB(data) {
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        const db = client.db(process.env.MONGODB_DB_NAME);
        const collection = db.collection(process.env.MONGODB_COLLECTION_NAME);
        
        const result = await collection.insertOne(data);
        console.log(`Data uploaded successfully with ID: ${result.insertedId}`);
        return true;
    } catch (error) {
        console.error('Error uploading to MongoDB:', error.message);
        return false;
    } finally {
        await client.close();
        console.log('MongoDB connection closed');
    }
}

async function main() {
    try {
        // Fetch data from HomeWizard
        const data = await fetchHomeWizardData();
        
        // Upload to MongoDB
        await uploadToMongoDB(data);
        
        console.log('Process completed successfully');
        console.log('Data saved:', data);
        
        // Calculate and display next update time
        const nextUpdate = new Date(Date.now() + INTERVAL);
        console.log(`Next update will occur at: ${nextUpdate.toLocaleString()}`);
    } catch (error) {
        console.error('Error in main process:', error.message);
    }
}

// Run the script immediately
main();

// Set up interval for subsequent runs
setInterval(main, INTERVAL); 