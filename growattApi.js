const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const tough = require('tough-cookie');
const crypto = require('crypto');
const qs = require('qs');

class Growatt {
    constructor() {
        this.BASE_URL = "https://server.growatt.com";
        this.cookieJar = new tough.CookieJar();
        this.session = wrapper(axios.create({ jar: this.cookieJar, withCredentials: true }));
    }

    _hashPassword(password) {
        return crypto.createHash('md5').update(password).digest('hex');
    }

    async login(username, password) {
        const passwordHash = this._hashPassword(password);

        const postData = qs.stringify({
            account: username,
            password: "",
            validateCode: "",
            isReadPact: 0,
            passwordCrc: passwordHash,
        });

        try {
            const res = await this.session.post(`${this.BASE_URL}/login`, postData, {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "User-Agent": "Mozilla/5.0", // Nodig bij sommige servers
                }
            });

            if (res.data && res.data.result === 1) {
                return true;
            } else {
                console.log("Login mislukt:", res.data.msg || res.data);
                return false;
            }
        } catch (err) {
            console.error("Fout tijdens login:", err.message);
            return false;
        }
    }

    async getPlants() {
        try {
            const res = await this.session.post(`${this.BASE_URL}/index/getPlantListTitle`);
            return res.data;
        } catch (err) {
            console.error("Fout bij ophalen plants:", err.message);
            return null;
        }
    }

    // Retrieves specific plant information by plantId
    async getPlant(plantId) {
        try {
            const res = await this.session.post(`${this.BASE_URL}/panel/getPlantData?plantId=${plantId}`);
            return res.data.obj;
        } catch (error) {
            console.error("Error fetching plant data: ", error.message);
            return null;
        }
    }

    // Get devices by plant (pagination)
    async  getDevicesByPlant(plantId, currPage = 1) {
        const data = {
            plantId: plantId,
            currPage: currPage,
        };

        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': 'Mozilla/5.0',
            'X-Requested-With': 'XMLHttpRequest',
        };

        try {
            const response = await this.session.post(
                `${this.BASE_URL}/panel/getDevicesByPlantList`,
                qs.stringify(data),
                { headers }
            );

            if (response.status === 200) {
                return response.data;
            } else {
                console.error(`Error: ${response.status}`);
                return null;
            }
        } catch (error) {
            console.error(`Request failed: ${error.message}`);
            return null;
        }
    }
}

// Status mapping
const statusMap = {
    "-1": "Offline",
    "1": "Online",
    "3": "Fault"
};


module.exports = { Growatt, statusMap };