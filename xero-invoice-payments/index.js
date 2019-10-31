const xeroConfig = require('./keys').xeroConfig;
const axios = require('axios');
const XeroClient = require('xero-node').AccountingAPIClient;
module.exports = async function(context, req) {
  // DEFINE REQUEST AUTH PARAMS
  let { workbookURL, workbookUserName, workbookPassword } = req.body;
  const oauth_token = req.body.authToken;

  // ENCRYPT WB CREDENTIALS
  const credentials = workbookUserName + ':' + workbookPassword;
  const encoded = Buffer.from(credentials).toString('base64');

  // SET WB HEADERS
  const auth = {
    headers: {
      Authorization: `Basic ${encoded}`,
      Accept: 'application/json',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Origin': '*',
      'X-Requested-With': 'application/json'
    }
  };
  try {
    // Connect to Xero
    let xero = new XeroClient(xeroConfig, oauth_token);

    context.log('xero1: ' + JSON.stringify(xero));

    // Send request data to the Xero invoices API and wait for a response

    const result = await xero.invoices.get({ Statuses: 'PAID' });

    context.log('result: ' + JSON.stringify(result));

    // GET PAID INVOICES IN XERO AND PUSH TO ARRAY
    const filtered = result.Invoices.filter(i => i.Reference.includes('WBID:'))
      .map(i => i.Reference)
      .map(s => +s.match(/WBID:\s*(\d+)/)[1]);

    context.log('FILTERED: ' + JSON.stringify(filtered));

    // USE XERO INVOICES ARRAY TO LOOP IN WB
    const WBInvoices = await filtered.map(async id => {
      const res = await axios.get(
        `https://immense-shore-64867.herokuapp.com/` +
          `${workbookURL}` +
          `api/invoice/${id}`,
        {
          headers: auth.headers
        }
      );
      return res.data;
    });

    // ONCE ALL RESULTS FROM WB ARE BACK, FLATTEN INTO 1 ARRAY
    const invoicesResponse = await Promise.all(WBInvoices);
    const flattenedinvoices = [].concat(...invoicesResponse);

    // MERGE XERO AND WB RESULTS BY INVOICE ID
    let merged = flattenedinvoices.map(item1 => {
      return Object.assign(
        item1,
        result.Invoices.find(item2 => {
          return item2 && item1.number === item2.invoice;
        })
      );
    });

    context.log('merged ' + JSON.stringify(merged));

    context.log('MOOOOOO' + context.res);

    // Send returned data from Xero including errors or warnings
    context.res = {
      status: 200,
      body: merged
    };
  } catch (e) {
    context.log(e);
    context.res = {
      status: 500,
      body: 500
    };
  }
};
