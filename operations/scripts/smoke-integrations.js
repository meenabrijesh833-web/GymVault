const axios = require('axios');

(async () => {
  try {
    const base = 'http://localhost:5000';
    const stamp = Date.now();
    const email = `owner${stamp}@test.com`;
    const password = 'Pass@12345';

    await axios.post(`${base}/api/auth/register-owner`, {
      gym_name: `Twilio Gym ${stamp}`,
      full_name: `Owner ${stamp}`,
      email,
      password,
    });

    const login = await axios.post(`${base}/api/auth/login`, { email, password });
    const headers = { headers: { 'x-auth-token': login.data.token } };

    const get1 = await axios.get(`${base}/api/settings/integrations`, headers);

    await axios.put(
      `${base}/api/settings/integrations`,
      {
        owner_mobile: '+917428204922',
        bulk_enabled: true,
        bulk_monthly_limit: 500,
        bulk_per_campaign_limit: 50,
        bulk_channels: { whatsapp: true, sms: true },
        templates: get1.data.templates,
      },
      headers
    );

    const get2 = await axios.get(`${base}/api/settings/integrations`, headers);
    console.log('GATEWAY_CONNECTED', get2.data.gateway_connected);
    console.log('OWNER_MOBILE', get2.data.owner_mobile);
    console.log('TEMPLATES', Array.isArray(get2.data.templates), get2.data.templates.length);
  } catch (error) {
    console.log('SMOKE_FAIL', error.response?.status, error.response?.data || error.message);
  }
})();
