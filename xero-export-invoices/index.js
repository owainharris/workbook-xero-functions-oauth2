const xeroConfig = require("./keys").xeroConfig;
const XeroClient = require("xero-node").AccountingAPIClient;
module.exports = async function(context, req) {
  const oauth_token = req.body.authToken;
  delete req.body.authToken;
  // Remove Total as Xero calculates this on import
  for (var i = 0; i < req.body.invoices.length; i++) {
    if (req.body.invoices[i].Total !== undefined) {
      delete req.body.invoices[i].Total;
    }
  }
  // Connect to Xero
  let xero = new XeroClient(xeroConfig, oauth_token);

  // Send request data to the Xero invoices API and wait for a response
  try {
    let result = await xero.invoices.create(req.body);
    // Check and filter for returned response errors or warnings for each invoice
    let issues = await result.Invoices.map(e => {
      return {
        invoice: e.InvoiceNumber,
        errors: e.ValidationErrors,
        warnings: e.Warnings
      };
    }).filter(obj => obj);
    let response = await issues;
    // Send returned data from Xero including errors or warnings
    context.res = {
      status: 200,
      body: response
    };
  } catch (e) {
    console.log(e);
    context.res = {
      status: 200,
      body: 500
    };
  }
};
