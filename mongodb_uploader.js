require('dotenv').config();
const  { Growatt, statusMap } = require('./growattApi');
const { MongoClient } = require('mongodb');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast?latitude=52.2556&longitude=5.034&hourly=cloud_cover&current=cloud_cover,temperature_2m&minutely_15=shortwave_radiation_instant,temperature_2m&forecast_days=1&forecast_minutely_15=1&past_minutely_15=1&timezone=auto';

const API_URL = "http://188.207.29.11:4444/api/v1/data";

const INTERVAL = 15 * 60 * 1000; // 15 minutes in milliseconds

//deze file laadt data in van de api en stuurt het door naar de mongodb

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
const startValues = new Map();
let lastRecordedDate = null;
async function fetchGrowattData(){

    const growatt = new Growatt();
    const isLoggedIn = await growatt.login(process.env.GROWATT_USER, process.env.GROWATT_PASS);
    console.log(isLoggedIn);
    if (isLoggedIn) {
        const plants = await growatt.getPlants();
        const plantId = plants[0].id;


        let devices = [];

        // Loop van pagina 1 t/m 5
        for (let page = 1; page <= 5; page++) {
            const response = await growatt.getDevicesByPlant(plantId, page);

            if (response && response.obj && response.obj.datas) {
                devices = devices.concat(response.obj.datas);
            }
        }

        const today = new Date().toISOString().split("T")[0];

        // Reset de startwaarden als het een nieuwe dag is
        if (lastRecordedDate !== today) {
            startValues.clear();
            lastRecordedDate = today;
        }

        // Filter en formatteer de devices
        const filteredDevices = devices
            .filter(device => device.alias?.startsWith('Chalet'))
            .map(device => {
                const chaletId = device.alias.replace('Chalet ', '').trim();
                const currentEToday = parseFloat(device.eToday || 0);

                // Sla de beginwaarde op als die er nog niet is
                if (!startValues.has(chaletId)) {
                    startValues.set(chaletId, currentEToday);
                }

                const startEToday = startValues.get(chaletId);
                const delta = +(currentEToday - startEToday).toFixed(2); // verschil afgerond

                return {
                    chalet: chaletId,
                    lastUpdateTime: device.lastUpdateTime || 'N/A',
                    eToday: currentEToday,
                    energyLast15Min: delta,
                    status: statusMap[String(device.status)] || 'Unknown'
                };
            });
        const outputPath = path.join(__dirname, 'growatt-data.json');
        fs.writeFileSync(outputPath, JSON.stringify(filteredDevices, null, 2), 'utf8');
        return filteredDevices;
    } else {
        console.log("Login is niet gelukt, geen data opgehaald.");
    }
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

async function main() {
    try {
        // Fetch data from HomeWizard
       const homeWizardData  = await fetchHomeWizardData();
        //Fetch data from Open-meteo
        const weatherData = await fetchWeatherData();
        //Fetch growattData
        const growattData = await fetchGrowattData();

       const data = {
            huidigeDateTime: weatherData.tijd, // geeft de tijd weer van laatste update weather api
            temperature: weatherData.temperatuur,
            bewolking: weatherData.bewolking,
            zonkracht: weatherData.zonkracht,
            verbruik: homeWizardData.verbruik,
            opwekking: homeWizardData.opwekking,
            chalets: growattData
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