const axios = require('axios');

const getJettonData = async (jettonAddress) => {
    const apiUrl = 'https://api.ston.fi/v2/pool/get_jetton_data';

    try {
        const response = await axios.post(apiUrl, {
            method: 'get_jetton_data',
            params: {
                jetton_address: jettonAddress
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error fetching Jetton data:', error);
        throw error;
    }
};

module.exports = { getJettonData };
