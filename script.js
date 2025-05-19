let verdeelkasten = [];
let totalImport = 0;
let totalExport = 0;

// Load the verdeelkasten configuration and fetch data
async function loadVerdeelkasten() {
    try {
        const response = await fetch('huisjes.json');
        if (!response.ok) {
            throw new Error('Failed to load verdeelkasten configuration');
        }
        const config = await response.json();
        verdeelkasten = config.Verdeelkasten;
        console.log('Loaded verdeelkasten:', verdeelkasten);
        // Start fetching data once we have the configuration
        await fetchAllData();
    } catch (error) {
        console.error('Error loading verdeelkasten:', error);
        displayError('Failed to load verdeelkasten configuration');
    }
}

async function fetchAllData() {
    try {
        const meterGrid = document.getElementById('meterGrid');
        meterGrid.innerHTML = ''; // Clear existing data
        totalImport = 0;
        totalExport = 0;

        // Create an array of promises for all API requests
        const fetchPromises = verdeelkasten.map(async (verdeelkast) => {
            if (!verdeelkast.api_url) {
                console.log(`Skipping ${verdeelkast.name} - No API URL provided`);
                displayVerdeelkastError(verdeelkast.name, 'No API URL configured');
                return;
            }

            try {
                console.log(`Fetching data from ${verdeelkast.name} at ${verdeelkast.api_url}`);
                const response = await fetch(verdeelkast.api_url);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                console.log(`Received data from ${verdeelkast.name}:`, data);
                
                // Update totals
                totalImport += data.total_power_import_kwh || 0;
                totalExport += data.total_power_export_kwh || 0;
                
                // Display the data
                displayVerdeelkastData(verdeelkast, data);
                
            } catch (error) {
                console.error(`Error fetching data for ${verdeelkast.name}:`, error);
                displayVerdeelkastError(verdeelkast.name, error.message);
            }
        });

        // Wait for all requests to complete
        await Promise.all(fetchPromises);
        
        // Update the summary display after all data is fetched
        updateSummaryDisplay();
        updateTimestamp();
        
    } catch (error) {
        console.error('Error in fetchAllData:', error);
        displayError('Failed to fetch data from one or more verdeelkasten');
    }
}

function displayVerdeelkastData(verdeelkast, data) {
    const meterGrid = document.getElementById('meterGrid');
    
    const meterCard = document.createElement('div');
    meterCard.className = 'meter-card';
    meterCard.id = `meter-${verdeelkast.id}`; // Add unique ID for each meter card
    
    // Create meter header with status
    const header = document.createElement('div');
    header.className = 'meter-header';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'meter-name';
    nameSpan.textContent = verdeelkast.name;
    
    const statusSpan = document.createElement('span');
    statusSpan.className = 'meter-status active';
    statusSpan.textContent = 'Active';
    
    header.appendChild(nameSpan);
    header.appendChild(statusSpan);
    meterCard.appendChild(header);

    // Create meter content
    const content = document.createElement('div');
    content.className = 'meter-content';

    // Create data grid
    const dataGrid = document.createElement('div');
    dataGrid.className = 'meter-data';

    // Add power data items
    const powerData = [
        {
            label: 'Power Import',
            value: data.total_power_import_kwh || 0,
            unit: 'kWh',
            type: 'import'
        },
        {
            label: 'Power Export',
            value: data.total_power_export_kwh || 0,
            unit: 'kWh',
            type: 'export'
        },
        {
            label: 'Current Power',
            value: data.current_power_w || 0,
            unit: 'W',
            type: 'neutral'
        }
    ];

    // Calculate and add net power
    const netPower = (data.total_power_import_kwh || 0) - (data.total_power_export_kwh || 0);
    powerData.push({
        label: 'Net Power',
        value: netPower,
        unit: 'kWh',
        type: netPower >= 0 ? 'import' : 'export'
    });

    // Create data items
    powerData.forEach(item => {
        const dataItem = createDataItem(item.label, item.value, item.unit, item.type);
        dataGrid.appendChild(dataItem);
    });

    // Create meter details section
    const details = document.createElement('div');
    details.className = 'meter-details';
    
    const detailsGrid = document.createElement('div');
    detailsGrid.className = 'meter-details-grid';

    // Add meter details
    const detailsData = [
        { label: 'Meter ID', value: verdeelkast.id },
        { label: 'Last Update', value: new Date().toLocaleTimeString() },
        { label: 'API URL', value: verdeelkast.api_url || 'Not configured' }
    ];

    detailsData.forEach(detail => {
        const detailItem = document.createElement('div');
        detailItem.className = 'detail-item';
        
        const detailLabel = document.createElement('div');
        detailLabel.className = 'detail-label';
        detailLabel.textContent = detail.label;
        
        const detailValue = document.createElement('div');
        detailValue.className = 'detail-value';
        detailValue.textContent = detail.value;
        
        detailItem.appendChild(detailLabel);
        detailItem.appendChild(detailValue);
        detailsGrid.appendChild(detailItem);
    });

    details.appendChild(detailsGrid);
    content.appendChild(dataGrid);
    content.appendChild(details);
    meterCard.appendChild(content);
    meterGrid.appendChild(meterCard);
}

function displayVerdeelkastError(verdeelkastName, errorMessage) {
    const meterGrid = document.getElementById('meterGrid');
    const meterCard = document.createElement('div');
    meterCard.className = 'meter-card';
    
    const header = document.createElement('div');
    header.className = 'meter-header';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'meter-name';
    nameSpan.textContent = verdeelkastName;
    
    const statusSpan = document.createElement('span');
    statusSpan.className = 'meter-status inactive';
    statusSpan.textContent = 'Inactive';
    
    header.appendChild(nameSpan);
    header.appendChild(statusSpan);
    
    const content = document.createElement('div');
    content.className = 'meter-content';
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = errorMessage || 'Failed to fetch data';
    
    content.appendChild(errorDiv);
    meterCard.appendChild(header);
    meterCard.appendChild(content);
    meterGrid.appendChild(meterCard);
}

function createDataItem(label, value, unit, type = '') {
    const item = document.createElement('div');
    item.className = 'data-item';
    
    const labelDiv = document.createElement('div');
    labelDiv.className = 'data-label';
    labelDiv.textContent = label;
    
    const valueDiv = document.createElement('div');
    valueDiv.className = `data-value ${type}`;
    valueDiv.textContent = `${(value || 0).toFixed(2)} ${unit}`;
    
    item.appendChild(labelDiv);
    item.appendChild(valueDiv);
    return item;
}

function updateSummaryDisplay() {
    document.getElementById('totalImport').textContent = `${totalImport.toFixed(2)} kWh`;
    document.getElementById('totalExport').textContent = `${totalExport.toFixed(2)} kWh`;
    const netPower = totalImport - totalExport;
    document.getElementById('netPower').textContent = `${netPower.toFixed(2)} kWh`;
}

function displayError(message) {
    const meterGrid = document.getElementById('meterGrid');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    meterGrid.appendChild(errorDiv);
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

// Update the event listener to load verdeelkasten instead
document.addEventListener('DOMContentLoaded', loadVerdeelkasten);

// Refresh data every 30 seconds
setInterval(fetchAllData, 30000); 