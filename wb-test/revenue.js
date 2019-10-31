const axios = require('axios');

module.exports = async function(connections, auth, activities) {
  try {
    activityIds = activities.map(i => i.Id);
    const revenueAccountsArr = await activityIds.map(async id => {
      const revenueURL = `api/finance/account/${id}`;
      const res = await axios.get(
        `https://immense-shore-64867.herokuapp.com/` +
          `${connections.baseURL}` +
          '/' +
          `${revenueURL}`,
        { headers: auth.get_headers }
      );
      return res.data;
    });
    const revenueAccounts = await Promise.all(revenueAccountsArr);
    let flattenedRevenue = activities.map(item1 => {
      return Object.assign(
        item1,
        revenueAccounts.find(item2 => {
          return item2 && item1.RevenueAccountId === item2.Id;
        })
      );
    });

    const mappedActRev = flattenedRevenue
      .map(item => {
        return {
          ActivityId: item.ActivityId,
          AccountNumber: item.AccountNumber
        };
      })
      .filter(item => {
        return item.AccountNumber !== undefined;
      });

    let revenue = mappedActRev;

    return revenue;
  } catch (e) {
    console.log(e);
  }
};
