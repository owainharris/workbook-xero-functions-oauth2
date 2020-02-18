const xeroConfig = require("./keys").xeroConfig;
const axios = require("axios");
const XeroClient = require("xero-node").AccountingAPIClient;
module.exports = async function(context, req) {
  // DEFINE REQUEST AUTH PARAMS
  let { workbookURL, workbookUserName, workbookPassword } = req.body;
  const oauth_token = req.body.authToken;

  // ENCRYPT WB CREDENTIALS
  const credentials = workbookUserName + ":" + workbookPassword;
  const encoded = Buffer.from(credentials).toString("base64");

  // SET WB HEADERS
  const auth = {
    headers: {
      Authorization: `Basic ${encoded}`,
      Accept: "application/json",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Origin": "*",
      "X-Requested-With": "application/json"
    }
  };
  try {
    // CONNECT TO XERO USING THE IMPORTED SDK
    let xero = new XeroClient(xeroConfig, oauth_token);

    context.log("xero " + xero);

    // Send request data to the Xero invoices API and wait for a response
    const result = await xero.invoices.get({
      Statuses: "PAID",
      createdByMyApp: true
    });

    context.log(JSON.stringify("result " + result));

    // GET PAID INVOICES IN XERO AND PUSH TO ARRAY
    // SELECT ONLY INVOICES THAT HAS A REFERENCE CONTAINING "WBID"
    const filtered = result.Invoices.filter(i => i.Reference.includes("Id:"))
      // CREATE A NEW ARRAY OF ONLY THE REFERENCE FIELD
      .map(i => i.Reference)
      // STRIP OUT THE "Id:" SO WE CAN UST OBTAIN AN ARRAY OF IDs TO SEND TO WORKBOOK
      .map(s => s.replace("Id: ", ""))
      .map(k => k.replace(/\,.*/, ""))
      // BELOW IS ONLY TO FILTER OUT AN INVOICE WE USED IN TESTING. CAN DELETE THIS LINE LATER
      .filter(r => r !== "INV159");

    context.log(JSON.stringify("filtered " + filtered));
    // IF NOTHING IS RETURNED, SEND BACK A 200 RESPONSE WITH a '401' CODE SO OUR APP CAN DISPLAY "NONE FOUND"
    if (filtered.length === 0) {
      context.res = {
        status: 200,
        body: 401
      };
      context.done();
    }

    // ELSE, USE THE IDs WE FILTERED TO LOOP THROUGH THE WORKBOOK INVOICES API AND RETURN MATCHING INVOICES
    const WBInvoices = await filtered.map(async id => {
      const res = await axios.get(
        `https://immense-shore-64867.herokuapp.com/` +
          `${workbookURL}` +
          `/api/invoice/${id}`,
        {
          headers: auth.headers
        }
      );
      return res.data;
    });

    // ONCE ALL RESULTS FROM WB ARE BACK, FLATTEN INTO 1 ARRAY
    const invoicesResponse = await Promise.all(WBInvoices);
    const flattenedinvoices = [].concat(...invoicesResponse);

    // FILTER OUT INVOICES THAT ARE ALREADY PAID IN WORKBOOK *STATUS 70*
    const unpaid = flattenedinvoices.filter(
      i => i.PaymentStatusForSystemsWithoutFinance < 70
    );

    // MERGE XERO AND WB RESULTS BY INVOICE ID
    let merged = unpaid.map(item1 => {
      return Object.assign(
        item1,
        result.Invoices.find(item2 => {
          return item2 && item1.number === item2.invoice;
        })
      );
    });

    // SEND MERGED DATA BACK TO OUR APP
    context.res = {
      status: 200,
      body: merged
    };
  } catch (e) {
    // IF XERO OR WORKBOOK FAILS, SEND A 200 CODE TO OUR APP WITH A 500 RESPONSE IN THE BODY SO OUR APP CAN DISPLAY THAT SOMETHING WENT WRONG AND TO CHECK THE XERO/WB CONNECTION SETTINGS
    context.log(e);
    context.res = {
      status: 200,
      body: "500"
    };
  }
};
