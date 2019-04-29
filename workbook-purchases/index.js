const axios = require("axios");
module.exports = async function(context, req) {
  const baseURL = await req.body.auth.baseURL;
  const workbookUserName = await req.body.auth.workbookUserName;
  const workbookPassword = await req.body.auth.workbookPassword;
  const credentials = workbookUserName + ":" + workbookPassword;
  const encoded = Buffer.from(credentials).toString("base64");
  const headers = {
    headers: {
      Authorization: `Basic ${encoded}`,
      Accept: "application/json",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Origin": "*",
      "X-Requested-With": "application/json"
    }
  };

  context.log("Starting parents");
  //GET INVOICE PARENTS
  try {
    const response = await axios.get(
      `https://immense-shore-64867.herokuapp.com/${baseURL}/api/followup/job/invoices/visualization/readyforprint`,
      headers
    );
    let invoices = response.data.map(i => {
      return {
        Type: "ACCREC",
        Total: i.TotalCurrencyAmount,
        Contact: {
          Name: i.CustomerName
        },
        Date: i.InvoiceDate,
        LineAmountTypes: "Exclusive",
        Reference: i.JobName,
        CurrencyCode: i.CurrencyCode,
        Status: "DRAFT",
        LineItems: {},
        Id: i.Id,
        InvoiceNumber: i.InvoiceNumber
      };
    });

    if (invoices.length === 0) {
      context.res = {
        status: 200,
        body: "none"
      };
    }

    let invoice_ids = invoices.map(invoice_ids => invoice_ids.Id);
    const invoiceDetialsArr = invoice_ids.map(async invoice_ids => {
      const response = await axios.get(
        `https://immense-shore-64867.herokuapp.com/${baseURL}/api/invoice/${invoice_ids}`,
        headers
      );
      return response.data;
    });
    const individualInvoices = await Promise.all(invoiceDetialsArr);

    const mappedDueDates = individualInvoices.map(item => {
      let dueDate = "";
      if (item.DueDate === undefined || item.DueDate === null) {
        dueDate = addDays(Date.now(), 30);
      } else {
        dueDate = item.DueDate;
      }
      return {
        Id: item.Id,
        DueDate: dueDate
      };
    });
    let final = invoices.map(item1 => {
      return Object.assign(
        item1,
        mappedDueDates.find(item2 => {
          return item2 && item1.Id === item2.Id;
        })
      );
    });

    // GET REVENUE
    const getActivities = await axios.get(
      `https://immense-shore-64867.herokuapp.com/${baseURL}/api/core/activities/company`,
      headers
    );
    let activitiesResults = await getActivities.data;

    let revenueIds = activitiesResults
      .filter(result => {
        return result.RevenueAccountId !== undefined;
      })
      .map(result => {
        return result.RevenueAccountId;
      });

    const uniqueRevenueIds = [...new Set(revenueIds)];

    const revenueAccountsArr = uniqueRevenueIds.map(async ids => {
      const response = await axios.get(
        `https://immense-shore-64867.herokuapp.com/${baseURL}/api/finance/account/${ids}`,
        headers
      );
      return response.data;
    });
    const revenueAccounts = await Promise.all(revenueAccountsArr);

    let flattenedRevenue = activitiesResults.map(item1 => {
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

    // IF invoices returned a non empty array, continue
    let ids = invoices.map(ids => ids.Id);

    const invoiceDetailsArr = ids.map(async ids => {
      const response = await axios.get(
        `https://immense-shore-64867.herokuapp.com/${baseURL}/api/invoice/${ids}/lines`,
        headers
      );
      return response.data;
    });
    const invoiceDetailsResponse = await Promise.all(invoiceDetailsArr);

    const flattenedinvoiceDetails = [].concat(...invoiceDetailsResponse);

    let invoiceDetails = flattenedinvoiceDetails.map(i => {
      return {
        Id: i.Id,
        InvoiceId: i.InvoiceId,
        Description: i.Description,
        Quantity: 1,
        UnitAmount: i.AmountNetCurrency,
        TaxAmount: i.AmountVATCurrency,
        AccountCode: i.ActivityId
      };
    });

    invoiceDetails.map(item1 => {
      return Object.assign(
        item1,
        revenue.find(item2 => {
          return item2 && item1.AccountCode === item2.ActivityId;
        })
      );
    });

    const detailsJoined = invoiceDetails.map(i => {
      return {
        Id: i.Id,
        InvoiceId: i.InvoiceId,
        Description: i.Description,
        Quantity: 1,
        UnitAmount: i.UnitAmount,
        TaxAmount: i.TaxAmount,
        AccountCode: i.AccountNumber
      };
    });

    const invoicesMappedToDetails = invoices.map(invoice => {
      invoice.LineItems = detailsJoined.filter(
        line => line.InvoiceId === invoice.Id
      );
      return invoice;
    });
    context.log(invoicesMappedToDetails);
    // return res.send(invoicesMappedToDetails);
    context.res = {
      status: 200,
      body: invoicesMappedToDetails
    };
  } catch (e) {
    context.res = {
      status: 200,
      body: "9"
    };
  }
};
