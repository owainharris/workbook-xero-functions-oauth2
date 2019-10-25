const invIds = require('./invoiceIds');
const invDetails = require('./invoiceDetails');
const invLines = require('./invoiceLines');
const act = require('./activities');
const rev = require('./revenue');

module.exports = async function(context, req) {
  // DEFINE REQUEST PARAMS
  const baseURL = await req.body.auth.baseURL;
  const workbookUserName = await req.body.auth.workbookUserName;
  const workbookPassword = await req.body.auth.workbookPassword;
  let companyID = await req.body.auth.companyID;
  if (companyID == undefined) {
    companyID = '';
  }
  const credentials = workbookUserName + ':' + workbookPassword;
  const encoded = Buffer.from(credentials).toString('base64');

  // DEFINE AUTH
  const auth = {
    post_headers: {
      Authorization: `Basic ${encoded}`,
      Accept: 'application/json'
    },
    get_headers: {
      Authorization: `Basic ${encoded}`,
      Accept: 'application/json',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Origin': '*',
      'X-Requested-With': 'application/json'
    }
  };
  //DEFINE URL STRINGS
  const connections = {
    baseURL: `${baseURL}`,
    invoiceIdsURL: `api/json/reply/DebtorInvoiceManagementFilterRequest`,
    activitiesURL: `api/core/activities/company`
  };

  //DEFINE PAYLOAD FOR INVOICE IDS
  const postPayload = {
    scope: 2,
    CompanyId: `${companyID}`
  };

  try {
    const invoices = await invIds(connections, postPayload, auth);
    context.log('invoices ' + invoices.data);

    if (invoices.data.length === 0) {
      context.res = {
        status: 200,
        body: 'none'
      };
    }

    const activities = await act(connections, auth);

    const [invoiceDetails, invoiceLines, revenue] = await Promise.all([
      invDetails(connections, auth, invoices),
      invLines(connections, auth, invoices),
      rev(connections, auth, activities)
    ]);

    invoiceLines.map(item1 => {
      return Object.assign(
        item1,
        revenue.find(item2 => {
          return item2 && item1.AccountCode === item2.ActivityId;
        })
      );
    });

    invoiceDetails.map(invoice => {
      invoice.LineItems = invoiceLines.filter(
        line => line.InvoiceId === invoice.Id
      );
      return invoice;
    });
    context.log(invoiceDetails);

    context.res = {
      status: 200,
      body: invoiceDetails
    };
  } catch (e) {
    context.res = {
      status: 200,
      body: '9'
    };
  }
};
