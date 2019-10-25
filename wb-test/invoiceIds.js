const axios = require('axios');

module.exports = async function(connections, postPayload, auth) {
  console.log(connections.baseURL);
  console.log(connections.invoiceIdsURL);
  console.log(auth.post_headers);

  try {
    const invoices = await axios({
      method: 'post',
      url: connections.baseURL + connections.invoiceIdsURL,
      data: postPayload,
      headers: auth.post_headers
    });
    console.log(invoices.data);
    return invoices;
  } catch (e) {
    console.log(e);
  }
};
