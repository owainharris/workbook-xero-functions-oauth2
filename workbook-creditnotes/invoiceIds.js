const axios = require("axios");

module.exports = async function(connections, postPayload, auth) {
  try {
    const invoices = await axios({
      method: "post",
      url:
        `https://immense-shore-64867.herokuapp.com/` +
        connections.baseURL +
        connections.invoiceIdsURL,
      data: postPayload,
      headers: auth.post_headers
    });
    console.log(invoices.data);
    return invoices;
  } catch (e) {
    console.log(e);
  }
};
