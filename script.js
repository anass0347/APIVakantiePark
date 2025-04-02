const API_URL = 'http://178.231.21.67/api/v1/data';

async function fetchData() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        displayData(data);
        updateTimestamp();
    } catch (error) {
        console.error('Error fetching data:', error);
        displayError('Failed to fetch data. Please try again.');
    }
}

function displayData(data) {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = ''; // Clear existing data

    // Only display total power import and export
    const powerData = {
        'Total Power Import': data.total_power_import_kwh,
        'Total Power Export': data.total_power_export_kwh
    };

    Object.entries(powerData).forEach(([key, value]) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${key}</td>
            <td>${value.toFixed(2)} kWh</td>
        `;
        tableBody.appendChild(row);
    });
}

async function fetchCurrentData() {
    try {
        const response = await fetch(`${API_URL}/current`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const currentData = await response.json();
        displayCurrentData(currentData);
    } catch (error) {
        console.error('Error fetching current data:', error);
    }
}

function displayCurrentData(data) {
    const tableBody = document.getElementById('tableBody');
    
    // Add current data to the table
    Object.entries(data).forEach(([key, value]) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatKey(key)}</td>
            <td>${formatValue(key, value)}</td>
        `;
        tableBody.appendChild(row);
    });
}

function formatKey(key) {
    // Convert camelCase or snake_case to Title Case
    return key
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
}

function formatValue(key, value) {
    // Format specific values based on their type
    if (typeof value === 'number') {
        if (key.includes('power') || key.includes('energy')) {
            return `${value.toFixed(2)} W`;
        } else if (key.includes('voltage')) {
            return `${value.toFixed(1)} V`;
        } else if (key.includes('current')) {
            return `${value.toFixed(2)} A`;
        }
    }
    return value;
}

function updateTimestamp() {
    const timestamp = document.getElementById('lastUpdate');
    const now = new Date();
    timestamp.textContent = `Last updated: ${now.toLocaleString()}`;
}

function displayError(message) {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = `
        <tr>
            <td colspan="2" style="color: red; text-align: center;">${message}</td>
        </tr>
    `;
}

// Fetch data when the page loads
document.addEventListener('DOMContentLoaded', fetchData);

// Refresh data every 30 seconds
setInterval(fetchData, 30000); 