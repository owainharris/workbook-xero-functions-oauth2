const axios = require('axios');

module.exports = async function(connections, auth) {
  try {
    const activities = await axios({
      method: 'get',
      url:
        `https://immense-shore-64867.herokuapp.com/` +
        connections.baseURL +
        connections.activitiesURL,
      headers: auth.get_headers
    });
    let activitiesResults = await activities.data;

    let activitesFiltered = activitiesResults.filter(result => {
      return result.RevenueAccountId !== undefined;
    });

    return activitesFiltered;
  } catch (e) {
    console.log(e);
  }
};
