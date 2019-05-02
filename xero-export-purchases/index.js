const xeroConfig = require("./keys").xeroConfig;
const XeroClient = require("xero-node").AccountingAPIClient;
module.exports = async function(context, req) {
  const oauth_token = req.body.authToken;
  delete req.body.authToken;
  // Remove Total as Xero calculates this on import
  for (var i = 0; i < req.body.purchaseOrders.length; i++) {
    if (req.body.purchaseOrders[i].Total !== undefined) {
      delete req.body.purchaseOrders[i].Total;
    }
  }
  // connect to xero
  let xero = new XeroClient(xeroConfig, oauth_token);

  // Send request data to the Xero purchases API and wait for a response
  try {
    let result = await xero.purchaseOrders.create(req.body);
    // Check and filter for returned response errors or warnings for each purchases
    let issues = result.PurchaseOrders.map(e => {
      return {
        purchase: e.PurchaseOrderNumber,
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
