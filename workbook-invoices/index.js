// IMPORT OUR REQUESTS WHEN REQUIRED
const invIds = require("./invoiceIds");
const act = require("./activities");
const invDetails = require("./invoiceDetails");
const invLines = require("./invoiceLines");
const rev = require("./revenue");

module.exports = async function(context, req) {
  // DEFINE REQUEST AUTH PARAMS
  let {
    baseURL,
    workbookUserName,
    workbookPassword,
    companyID
  } = req.body.auth;

  // REMOVE TRAILING '/' AS SOME CLIENTS INCLUDE THIS
  baseURL = baseURL.replace(/\/$/, "");

  /* SOME CLIENTS DONT HAVE MULTI COMPANY.
  IF NOT, A BLANK COMPANY ID WILL JUST RETURL ALL */
  if (companyID == undefined) {
    companyID = "";
  }

  // ENCRYPT CREDENTIALS
  const credentials = workbookUserName + ":" + workbookPassword;
  const encoded = Buffer.from(credentials).toString("base64");

  // POST REQUEST DOESN'T REQUIRE CORS, SO WE USE DIFFERENT HEADERS FOR GET AND POST
  const auth = {
    post_headers: {
      Authorization: `Basic ${encoded}`,
      Accept: "application/json",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Origin": "*",
      "X-Requested-With": "application/json"
    },
    get_headers: {
      Authorization: `Basic ${encoded}`,
      Accept: "application/json",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Origin": "*",
      "X-Requested-With": "application/json"
    }
  };

  //DEFINE URL STRINGS
  const connections = {
    baseURL: `${baseURL}`,
    invoiceIdsURL: `/api/json/reply/DebtorInvoiceManagementFilterRequest`,
    activitiesURL: `/api/core/activities/company`
  };

  //DEFINE PAYLOAD FOR INVOICE IDS. SCOPE=2 RETRIEVES READY TO INVOICE STATUS
  const postPayload = {
    scope: 2,
    CompanyId: `${companyID}`
  };

  try {
    /*
    RETRIEVE BOTH INVOICE IDs AND ACTIVITY IDs. WE WILL NEED THESE
    TO LOOP THROUGH MORE REQUESTS LATER.
    IF NO INVOICE IDs EXIST, RETURN A 200 RESPONSE (OK) AND LET THE CLIENT KNOW
    THERE ARE NO INVOICES, AND NOT TO CONTINUE WITH THE REST OF THE API CALLS.
    */
    const invoices = await invIds(connections, postPayload, auth);
    if (invoices.data.length === 0) {
      context.res = {
        status: 200,
        body: "none"
      };
      context.done();
    }
    const activities = await act(connections, auth);

    /* NOW THAT WE HAVE OUR IDs, WE CAN LOOP THROUGH THE OTHER REQUESTS */
    const [invoiceDetails, invoiceLines, revenue] = await Promise.all([
      invDetails(connections, auth, invoices),
      invLines(connections, auth, invoices),
      rev(connections, auth, activities)
    ]);

    /* NOW WE HAVE ALL OUR DATA, WE NEED TO MERGE ACTIVITES
    INTO THE SAME OBJECT AS OUR REVENUE. */
    invoiceLines.map(item1 => {
      return Object.assign(
        item1,
        revenue.find(item2 => {
          return item2 && item1.ActivityId === item2.ActivityId;
        })
      );
    });

    /* NOW WE HAVE ALL OUR DATA, WE NEED TO MERGE OUR INVOICE
    LINE ITEMS INTO THE INVOICE THEY BELONG TO BY THE INVOICE ID. */
    invoiceDetails.map(invoice => {
      invoice.LineItems = invoiceLines.filter(
        line => line.InvoiceId === invoice.Id
      );
      return invoice;
    });


    /* IF NO ERRORS, RETURN HTTP 200 WITH PAYLOAD TO CLIENT */
    context.res = {
      status: 200,
      body: invoiceDetails
    };

    /* IF THERE WAS AN ERROR, RETURN ERROR CODE 9 TO THE CLIENT.
        THIS TELLS THE CLIENT IN THE APPLICATION TO CHECK THEIR WB CONNECTION SETTINGS
       */
  } catch (e) {
    context.res = {
      status: 200,
      body: "9"
    };
  }
};
