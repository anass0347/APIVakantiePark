require('dotenv').config();
const  { Growatt, statusMap } = require('./growattApi');
const { MongoClient } = require('mongodb');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast?latitude=52.2556&longitude=5.034&hourly=cloud_cover&current=cloud_cover,temperature_2m&minutely_15=shortwave_radiation_instant,temperature_2m&forecast_days=1&forecast_minutely_15=1&past_minutely_15=1&timezone=auto';

const HOMEWIZARD_API_MAP = {
    "101": "http://188.207.29.11:4444/api/v1/data",  // Chalet 101
    // Voeg hier de andere urls toe met het chalet nummer
};

const INTERVAL = 15 * 60 * 1000; // 15 minutes in milliseconds

//deze file laadt data in van de api en stuurt het door naar de mongodb

async function fetchHomeWizardData() {
    const results = {};

    for (const [chaletId, url] of Object.entries(HOMEWIZARD_API_MAP)) {
        try {
            const response = await axios.get(url);
            results[chaletId] = {
                verbruik: response.data.total_power_import_kwh,
                opwekking: response.data.total_power_export_kwh
            };
        } catch (error) {
            console.error(`Error fetching HomeWizard data for chalet ${chaletId}:`, error.message);
            results[chaletId] = {
                verbruik: null,
                opwekking: null,
                error: true
            };
        }
    }
    return results; // Object met chaletId als key
}



async function fetchGrowattData() {
    const growatt = new Growatt();
    const isLoggedIn = await growatt.login(process.env.GROWATT_USER, process.env.GROWATT_PASS);

    if (!isLoggedIn) {
        console.log("Login is niet gelukt, geen data opgehaald.");
        return [];
    }

    const plants = await growatt.getPlants();
    const plantId = plants[0].id;

    let devices = [];
    for (let page = 1; page <= 5; page++) {
        const response = await growatt.getDevicesByPlant(plantId, page);
        if (response?.obj?.datas) {
            devices = devices.concat(response.obj.datas);
        }
    }

    const lastDbEntry = await getLastEntryFromMongoDB();

    // Controleer of de vorige timestamp binnen 20 minuten is
    let isRecentEnough = false;
    const previousGrowattData = {};

    if (lastDbEntry?.huidigeDateTime && lastDbEntry?.chalets) {
        const previousTime = new Date(lastDbEntry.huidigeDateTime).getTime();
        const now = Date.now();
        const timeDiff = Math.abs(now - previousTime);

        if (timeDiff <= 20 * 60 * 1000) {
            isRecentEnough = true;
            for (const chalet of lastDbEntry.chalets) {
                if (chalet.eToday !== undefined) {
                    previousGrowattData[chalet.chalet] = chalet.eToday;
                }
            }
        } else {
            console.warn("Vorige entry is ouder dan 20 minuten. energyLast15Min wordt 'N/A'");
        }
    }

    const todayData = devices
        .filter(device => device.alias?.startsWith('Chalet'))
        .map(device => {
            const chaletId = device.alias.replace('Chalet ', '').trim();
            const currentEToday = parseFloat(device.eToday || 0);
            const previousEToday = parseFloat(previousGrowattData[chaletId] || 0);

            const delta = isRecentEnough && previousGrowattData[chaletId] !== undefined
                ? +(currentEToday - previousEToday).toFixed(2)
                : "N/A";

            return {
                chalet: chaletId,
                lastUpdateTime: device.lastUpdateTime || 'N/A',
                eToday: currentEToday,
                energyLast15Min: delta,
                status: statusMap[String(device.status)] || 'Unknown'
            };
        });

    const outputPath = path.join(__dirname, 'growatt-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(todayData, null, 2), 'utf8');
    return todayData;
}


async function fetchWeatherData() {
    try {
        const response = await axios.get(WEATHER_API_URL);

        const weather = response.data;

        const latestTimeIndex = weather.minutely_15.time.length - 1;
        const latestTime = weather.minutely_15.time[latestTimeIndex];
        const latestTemperature = weather.minutely_15.temperature_2m[latestTimeIndex];
        const latestCloudCover = weather.current.cloud_cover;
        const latestSolarRadiation = weather.minutely_15.shortwave_radiation_instant[latestTimeIndex];

        return {
            tijd: latestTime,
            temperatuur: latestTemperature,
            bewolking: latestCloudCover,
            zonkracht: latestSolarRadiation
        };
    } catch (error) {
        console.error('Error fetching weather data:', error.message);
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

async function getLastEntryFromMongoDB() {
    const client = new MongoClient(process.env.MONGODB_URI);

    try {
        await client.connect();
        console.log('Connected to MongoDB');

        const db = client.db(process.env.MONGODB_DB_NAME);
        const collection = db.collection(process.env.MONGODB_COLLECTION_NAME);

        const lastEntry = await collection
            .find({})
            .sort({ _id: -1 }) // Sort by _id in descending order (newest first)
            .limit(1)
            .toArray();

        if (lastEntry.length === 0) {
            console.log('No documents found');
            return null;
        }

        console.log('Last entry retrieved:', lastEntry[0]);
        return lastEntry[0];
    } catch (error) {
        console.error('Error retrieving last entry from MongoDB:', error.message);
        return null;
    } finally {
        await client.close();
        console.log('MongoDB connection closed');
    }
}

async function main() {
    try {
        // Fetch data from HomeWizard
        const homeWizardDataMap = await fetchHomeWizardData();
        //Fetch data from Open-meteo
        const weatherData = await fetchWeatherData();
        //Fetch growattData
        const growattData = await fetchGrowattData();

        const growattDataMap = {};
        for (const entry of growattData) {
            growattDataMap[entry.chalet] = entry;
        }

        const allChaletIds = new Set([
            ...Object.keys(growattDataMap),
            ...Object.keys(homeWizardDataMap)
        ]);

        const combinedChaletData = Array.from(allChaletIds).map(chaletId => {
            return {
                chalet: chaletId,
                ...growattDataMap[chaletId],
                ...homeWizardDataMap[chaletId],
            };
        });

       const data = {
            huidigeDateTime: weatherData.tijd, // geeft de tijd weer van laatste update weather api
            temperature: weatherData.temperatuur,
            bewolking: weatherData.bewolking,
            zonkracht: weatherData.zonkracht,
            chalets: combinedChaletData
        };
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