const xeroConfig = require("./keys").xeroConfig;
const XeroClient = require("xero-node").AccountingAPIClient;
module.exports = async function(context, req) {
  context.log("req" + JSON.stringify(req));
  const oauth_token = req.body.authToken;
  delete req.body.authToken;
  // Remove Total as Xero calculates this on import
  for (var i = 0; i < req.body.creditNotes.length; i++) {
    if (req.body.creditNotes[i].Total !== undefined) {
      delete req.body.creditNotes[i].Total;
    }
  }
  // RENAME ALL KEYS FROM INVOICENUMBER TO CREDITNOTENUMBER
  const renamed = req.body.creditNotes.map(item => {
    const obj = {
      ...item,
      CreditNoteNumber: item.InvoiceNumber
    };
    delete obj.InvoiceNumber;
    return obj;
  });

  // TURN ARRAY ABOVE BACK INTO AN OBJECT WITH HEADER
  const toPost = { CreditNotes: renamed };

  // Connect to Xero
  let xero = new XeroClient(xeroConfig, oauth_token);

  // Send request data to the Xero creditNotes API and wait for a response
  try {
    let result = await xero.creditNotes.create(toPost);
    // Check and filter for returned response errors or warnings for each invoice
    let issues = await result.CreditNotes.map(e => {
      return {
        creditNote: e.CreditNoteNumber,
        errors: e.ValidationErrors,
        warnings: e.Warnings
      };
    }).filter(obj => obj);
    let response = await issues;

    console.log("Issues: " + response);
    console.log("Issues: " + JSON.stringify(response));

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
