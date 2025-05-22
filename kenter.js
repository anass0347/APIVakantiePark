// Kenter Backend Proxy Configuration
const BACKEND_API_BASE = 'http://localhost:3001/api/kenter/usage';

const KENTER_CONNECTION_ID = '871685900041061903'; // <--  real connectionId
const KENTER_METERING_POINT_ID = '6500110544';      // <--  real meteringPointId

/**
 * Fetch power data for a specific time period from the backend proxy
 * @param {string} periodType - 'days' or 'months'
 * @param {number} year - The year to fetch data for
 * @param {number} month - The month to fetch data for (1-12)
 * @param {number} [day] - The day to fetch data for (1-31), only used when periodType is 'days'
 * @returns {Promise<Object>} The power usage data
 */
async function fetchPowerDataByPeriod(periodType, year, month, day = null) {
    try {
        console.log('Frontend: Fetching power data from backend:', {
            periodType,
            year,
            month,
            day
        });
        let url = `${BACKEND_API_BASE}?periodType=${encodeURIComponent(periodType)}&year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`;
        if (periodType === 'days' && day) {
            url += `&day=${encodeURIComponent(day)}`;
        }
        console.log('Frontend: Requesting URL:', url);
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Backend error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        const data = await response.json();
        console.log('Frontend: Received data from backend:', data);
        return data;
    } catch (error) {
        console.error('Frontend: Error fetching power data from backend:', error);
        throw error;
    }
}

// Export only the backend-based function
export {
    fetchPowerDataByPeriod
}; 