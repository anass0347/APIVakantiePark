// Kenter API configuration
const KENTER_API_URL = '/api/kenter/data'; // Using our mock API endpoint

// Function to fetch data from Kenter API
async function fetchKenterData() {
    try {
        const response = await fetch(KENTER_API_URL, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        displayKenterData(data);
        updateTimestamp();
    } catch (error) {
        console.error('Error fetching Kenter data:', error);
        document.getElementById('tableBody').innerHTML = `
            <tr>
                <td colspan="2" style="color: red; text-align: center;">
                    Error fetching data: ${error.message}
                </td>
            </tr>
        `;
    }
}

// Function to display Kenter data in the table
function displayKenterData(data) {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';

    // Extract data from the Parkstaat object
    const parkstaat = data.Parkstaat || {};
    
    // Basic park information
    const basicInfo = {
        'Timestamp': parkstaat.huidigeDateTime || 'N/A',
        'Temperature': parkstaat.temperature ? `${parkstaat.temperature}°C` : 'N/A',
        'Solar Radiation': parkstaat.zonkracht ? `${parkstaat.zonkracht} W/m²` : 'N/A',
        'Cloud Cover': parkstaat.bewolking ? `${parkstaat.bewolking}/10` : 'N/A',
        'Population': parkstaat.bevolking || 'N/A'
    };

    // Add basic info to the table
    for (const [key, value] of Object.entries(basicInfo)) {
        addRowToTable(tableBody, key, value);
    }

    // Add a separator row
    addRowToTable(tableBody, '', '');

    // Network information
    const stroomnetwerk = parkstaat.stroomnetwerk || {};
    const networkInfo = {
        'Network Name': stroomnetwerk.netwerkNaam || 'N/A',
        'Network Description': stroomnetwerk.netwerkBeschrijving || 'N/A',
        'Network Type': stroomnetwerk.netwerkType || 'N/A',
        'Power Ingress': stroomnetwerk.ingress ? `${stroomnetwerk.ingress} kW` : 'N/A',
        'Power Egress': stroomnetwerk.egress ? `${stroomnetwerk.egress} kW` : 'N/A'
    };

    // Add network info to the table
    for (const [key, value] of Object.entries(networkInfo)) {
        addRowToTable(tableBody, key, value);
    }

    // Add a separator row
    addRowToTable(tableBody, '', '');

    // Add a section for the first main meter box
    const hoofdmeterkasten = stroomnetwerk.hoofdmeterkasten || [];
    if (hoofdmeterkasten.length > 0) {
        addRowToTable(tableBody, 'Main Meter Boxes', `${hoofdmeterkasten.length} boxes`);
        
        // Display information about the first main meter box
        const firstMeterBox = hoofdmeterkasten[0];
        const hoofdkabels = firstMeterBox.hoofdkabels || [];
        
        if (hoofdkabels.length > 0) {
            addRowToTable(tableBody, 'Main Cables', `${hoofdkabels.length} cables`);
            
            // Display information about the first main cable
            const firstCable = hoofdkabels[0];
            const cableInfo = {
                'Cable Diameter': firstCable.diameter ? `${firstCable.diameter} mm` : 'N/A',
                'Cable Throughput': firstCable.throughput ? `${firstCable.throughput} A` : 'N/A',
                'Cable Length': firstCable.lengte ? `${firstCable.lengte} m` : 'N/A',
                'Cable Material': firstCable.materiaal || 'N/A'
            };
            
            for (const [key, value] of Object.entries(cableInfo)) {
                addRowToTable(tableBody, key, value);
            }
            
            // Display information about distribution meter boxes
            const verdeelmeterkasten = firstCable.verdeelmeterkasten || [];
            if (verdeelmeterkasten.length > 0) {
                addRowToTable(tableBody, 'Distribution Meter Boxes', `${verdeelmeterkasten.length} boxes`);
                
                // Display information about the first distribution meter box
                const firstDistBox = verdeelmeterkasten[0];
                addRowToTable(tableBody, 'Smart Meter ID', firstDistBox.SlimmeMeterId || 'N/A');
                
                // Display information about sub-cables
                const subkabels = firstDistBox.subkabels || [];
                if (subkabels.length > 0) {
                    addRowToTable(tableBody, 'Sub-cables', `${subkabels.length} cables`);
                    
                    // Display information about the first sub-cable
                    const firstSubCable = subkabels[0];
                    const subCableInfo = {
                        'Sub-cable Diameter': firstSubCable.diameter ? `${firstSubCable.diameter} mm` : 'N/A',
                        'Sub-cable Throughput': firstSubCable.throughput ? `${firstSubCable.throughput} A` : 'N/A',
                        'Sub-cable Length': firstSubCable.lengte ? `${firstSubCable.lengte} m` : 'N/A',
                        'Sub-cable Material': firstSubCable.materiaal || 'N/A'
                    };
                    
                    for (const [key, value] of Object.entries(subCableInfo)) {
                        addRowToTable(tableBody, key, value);
                    }
                    
                    // Display information about plots
                    const kavels = firstSubCable.kavels || [];
                    if (kavels.length > 0) {
                        addRowToTable(tableBody, 'Plots', `${kavels.length} plots`);
                        
                        // Display information about the first plot
                        const firstPlot = kavels[0];
                        const plotInfo = {
                            'Plot ID': firstPlot.kavelId || 'N/A',
                            'Number of Houses': firstPlot.aantalHuizen || 'N/A',
                            'Power Consumption': firstPlot.verbruik ? `${firstPlot.verbruik} kW` : 'N/A',
                            'Power Generation': firstPlot.opwekking ? `${firstPlot.opwekking} kW` : 'N/A',
                            'Solar Panels': firstPlot.zonnepanelen ? 'Yes' : 'No'
                        };
                        
                        for (const [key, value] of Object.entries(plotInfo)) {
                            addRowToTable(tableBody, key, value);
                        }
                    }
                }
            }
        }
    }
}

// Helper function to add a row to the table
function addRowToTable(tableBody, key, value) {
    const row = document.createElement('tr');
    
    const keyCell = document.createElement('td');
    keyCell.textContent = key;
    
    const valueCell = document.createElement('td');
    valueCell.textContent = value;
    
    row.appendChild(keyCell);
    row.appendChild(valueCell);
    
    tableBody.appendChild(row);
}

// Function to update the timestamp
function updateTimestamp() {
    const timestampElement = document.getElementById('lastUpdate');
    const now = new Date();
    timestampElement.textContent = `Last updated: ${now.toLocaleString()}`;
}

// Fetch data when the page loads
document.addEventListener('DOMContentLoaded', fetchKenterData); 




Client is toegevoegd
Er is een nieuwe API-client aangemaakt in ons systeem. Je hebt onderstaande gegevens nodig om in te kunnen loggen met deze client.

Client ID:
api_10162_9f5a0e

Applicatiewachtwoord:
ZKJ0clJBav63$*ORPxGu02Tc

Let op: bewaar het applicatiewachtwoord op een veilige plaats. We kunnen dit niet opnieuw tonen



/*
{
    "access_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6IkRFNjUzNTZGQzk5RDc3QkM0OUM0REIxNUQ4NjVBQ0M3IiwidHlwIjoiYXQrand0In0.eyJpc3MiOiJodHRwczovL2xvZ2luLmtlbnRlci5udSIsIm5iZiI6MTc0NTQxODg3NiwiaWF0IjoxNzQ1NDE4ODc2LCJleHAiOjE3NDU0MjI0NzYsImF1ZCI6WyJtZWV0ZGF0YS1wdWJsaWMtYXBpIiwiaHR0cHM6Ly9sb2dpbi5rZW50ZXIubnUvcmVzb3VyY2VzIl0sInNjb3BlIjpbIm1lZXRkYXRhLnJlYWQiXSwiY2xpZW50X2lkIjoiYXBpXzEwMTYyXzlmNWEwZSIsImNsaWVudF90eXBlIjoicHVibGljX2FwaV9jbGllbnQiLCJkZWJ0b3JfaWQiOiIxMDE2MiJ9.WDAgHuhSqy0FeHJT972H11-xWaCTqowD39xEOvhGoM3vvZeQsQEOY3b-LRwHh50kS60YSyCnos4A3yI_jdC1E4re5V-3C9WO__3QhEWZaTSahN6qp5ub7fYlvOcu2Sd6EbqsUvY-NHNWExjg7IlMh9c9_5JGI-UbhjxIwz2vGio_cLS1nBOHUBxqLfU6wblSdF1KhwH7QqjRToMMFn4CHd5pnV8xfAvU9LEYR_j7NQgN6pBUMgcM0zh2l2ccX-ZfcVAIfIOdC-U29y5V9TBB18lYYKlucxvlIp-b_TIeMXhLCnHcXvCFnS2FnKmy9lW5VCE90-QWzUYVIUiLFFGREQ",
    "expires_in": 3600,
    "token_type": "Bearer",
    "scope": "meetdata.read"
}




*/ 