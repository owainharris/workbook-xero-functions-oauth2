const axios = require('axios');

module.exports = async function(context, req) {
  // GET AUTHENTICATION DETAILS FROM USER POST
  let baseURL = await req.body.auth.baseURL;
  const workbookUserName = await req.body.auth.workbookUserName;
  const workbookPassword = await req.body.auth.workbookPassword;
  let companyID = await req.body.auth.companyID;
  const credentials = workbookUserName + ':' + workbookPassword;
  const encoded = Buffer.from(credentials).toString('base64');
  if (companyID == undefined) {
    companyID = 1;
  }
  const headers = {
    headers: {
      Authorization: `Basic ${encoded}`,
      Accept: 'application/json',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Origin': '*',
      'X-Requested-With': 'application/json'
    }
  };

  const headers2 = {
    headers: {
      Authorization: `Basic ${encoded}`,
      Accept: 'application/json'
    }
  };

  // REMOVE TRAILING '/' AS SOME CLIENTS INCLUDE THIS
  baseURL = baseURL.replace(/\/$/, '');

  try {
    // GET CREDITOR INVOICE PARENTS

    const creditors = await axios.get(
      `${baseURL}/api/finance/01/vouchers`,
      headers2
    );

    // IF THERE ARE NO CREDITOR INVOICES, STOP THE FUNCTION HERE AND RETURN
    if (creditors.data.length === 0) {
      context.res = {
        status: 200,
        body: 'none'
      };
    }

    let creditorInvoices = await creditors.data

      // FILTER FOR: STAUS=40 (PROCESSED), TYPE=1(CREDITOR INVOICE)
      .filter(i => i.VoucherStatusId === 40 && i.VoucherType === 0)
      .map(i => {
        if (i.Comment === undefined) {
          i.Comment = '';
        }
        // RETURN DATA IN FORMAT WE WILL SEND BACK TO THE CLIENT AND THEN TO XERO
        return {
          Type: 'ACCPAY',
          Total: i.TotalAmount,
          VendorId: i.VendorId,
          Date: i.InvoiceDate,
          InvoiceDueDate: i.InvoiceDueDate,
          LineAmountTypes: 'Exclusive',
          Reference: i.Comment,
          CurrencyId: i.CurrencyId,
          Status: 'DRAFT',
          LineItems: {},
          CreditorInvoiceId: i.Id,
          InvoiceNumber: i.InvoiceNumber,
          VoucherNumber: i.VoucherNumber
        };
      });

    // EXTRACT PARENT CREDITOR INVOICE ID's SO WE CAN LOOP THROUGH REQUESTS AND GET THEIR LINE ITEMS
    let creditorInvoiceIds = creditorInvoices.map(ids => ids.CreditorInvoiceId);

    // LOOP THROUGH INVOICE DETIALS
    const creditorInvoiceDetailsArr = await creditorInvoiceIds.map(
      async ids => {
        const response = await axios.get(
          `https://immense-shore-64867.herokuapp.com/${baseURL}/api/finance/voucher/${ids}/details`,
          headers
        );
        return response.data;
      }
    );

    // FLATTEN ALL RESPONSES INTO AN ARRAY
    const creditorInvoiceDetailsResponse = await Promise.all(
      creditorInvoiceDetailsArr
    );

    const flattenedCreditorInvoiceDetails = [].concat(
      ...creditorInvoiceDetailsResponse
    );

    // NEXT WE CAN OBTAIN EMPOYEE DATA
    const vendorResponse = await axios.get(
      `https://immense-shore-64867.herokuapp.com/${baseURL}/api/finance/accounts/creditors?EmployeeCreditor=false`,
      headers
    );
    let vendors = vendorResponse.data.map(i => {
      return {
        Id: i.Id,
        Name: i.Name
      };
    });

    // NEXT WE CAN OBTAIN OUR CURRENCY DATA
    const currencyResponse = await axios.get(
      `https://immense-shore-64867.herokuapp.com/${baseURL}/api/core/currencies`,
      headers
    );
    let currencies = await currencyResponse.data.map(i => {
      return {
        Id: i.Id,
        IsoCode: i.IsoCode
      };
    });

    // GET ACTIVITIES
    const getActivities = await axios.get(
      `https://immense-shore-64867.herokuapp.com/${baseURL}/api/core/activities/company`,
      headers
    );
    let activitiesResults = await getActivities.data;

    context.log('activitiesResults ' + JSON.stringify(activitiesResults));

    /*******************************************************************/
    // EXTRACT A NEW ARRAY TO GET REVENUE AND COST ACCOUNT IDs. WE WILL NEED THIS TO MERGE ACTIVIES WITH REVENUE CODES

    let revenueIds = activitiesResults
      .map(i => i.RevenueAccountId)
      .filter(Boolean);
    const uniqueRevenueIds = [...new Set(revenueIds)];

    context.log('uniqueRevenueIds ' + JSON.stringify(uniqueRevenueIds));

    let chargeableIds = activitiesResults
      .map(i => i.ChargeableJobAccountId)
      .filter(Boolean);
    const uniqueChargeableIds = [...new Set(chargeableIds)];

    context.log('chargeableIds ' + JSON.stringify(chargeableIds));

    let nonChargeableIds = activitiesResults
      .map(i => i.NonChargeableJobAccountId)
      .filter(Boolean);
    const uniqueNonChargeableIds = [...new Set(nonChargeableIds)];

    context.log('nonChargeableIds ' + JSON.stringify(nonChargeableIds));

    /****************************************************************/

    /****************************************************************/
    // USE THE UNIQUE IDS ABOVE TO LOOP THROUGH AND GET REQUIRED REVENUE DATA
    // GET REVENUE
    const revenueAccountsArr = uniqueRevenueIds.map(async ids => {
      const response = await axios.get(
        `https://immense-shore-64867.herokuapp.com/${baseURL}/api/finance/account/${ids}`,
        headers
      );
      return response.data;
    });
    const revenueAccounts = await Promise.all(revenueAccountsArr);
    const revenueAccountsMapped = revenueAccounts.map(i => {
      return {
        Id: i.Id,
        RevAccountNumber: i.AccountNumber
      };
    });

    context.log(
      'revenueAccountsMapped ' + JSON.stringify(revenueAccountsMapped)
    );

    // GET CHARGEABLE
    const chargeableAccountsArr = uniqueChargeableIds.map(async ids => {
      const response = await axios.get(
        `https://immense-shore-64867.herokuapp.com/${baseURL}/api/finance/account/${ids}`,
        headers
      );
      return response.data;
    });
    const chargeableAccounts = await Promise.all(chargeableAccountsArr);
    const chargeableAccountsMapped = chargeableAccounts.map(i => {
      return {
        Id: i.Id,
        ChargeableAccountNumber: i.AccountNumber
      };
    });

    context.log(
      'chargeableAccountsMapped ' + JSON.stringify(chargeableAccountsMapped)
    );

    // GET NON CHARGEABLE
    const nonChargeableAccountsArr = uniqueNonChargeableIds.map(async ids => {
      const response = await axios.get(
        `https://immense-shore-64867.herokuapp.com/${baseURL}/api/finance/account/${ids}`,
        headers
      );
      return response.data;
    });
    const nonChargeableAccounts = await Promise.all(nonChargeableAccountsArr);
    const nonChargeableAccountsMapped = nonChargeableAccounts.map(i => {
      return {
        Id: i.Id,
        NonChargeableAccountNumber: i.AccountNumber
      };
    });

    context.log(
      'nonChargeableAccountsMapped ' +
        JSON.stringify(nonChargeableAccountsMapped)
    );
    /****************************************************************/

    /****************************************************************/
    // NOW WE NEED TO MERGE ACTIVITIES WITH REVENUE ACCOUNTS
    let costsMerged = activitiesResults.map(item1 => {
      return Object.assign(
        item1,
        revenueAccountsMapped.find(item2 => {
          return item2 && item1.RevenueAccountId === item2.Id;
        }),
        chargeableAccountsMapped.find(item2 => {
          return item2 && item1.ChargeableJobAccountId === item2.Id;
        }),
        nonChargeableAccountsMapped.find(item2 => {
          return item2 && item1.NonChargeableJobAccountId === item2.Id;
        })
      );
    });

    context.log('costsMerged ' + JSON.stringify(costsMerged));
    /****************************************************************/

    // NOW LETS ONLY RETURN THE FIELDS WE NEED FROM THE ARRAY
    const mappedActRev = costsMerged.map(item => {
      let account;
      // if (item.costAccountNumber !== undefined) {
      //   account = item.costAccountNumber;
      // } else {
      //   account = item.AccountNumber;
      // }
      if (item.RevAccountNumber) {
        account = item.RevAccountNumber;
      }
      if (item.ChargeableAccountNumber) {
        account = item.ChargeableAccountNumber;
      }
      if (item.NonChargeableAccountNumber) {
        account = item.NonChargeableAccountNumber;
      }

      return {
        ActivityId: item.ActivityId,
        AccountNumber: account
      };
    });
    // WE NEED TO STRIP OUT ANY REDUNDANT ACTIVITES
    // .filter(item => {
    //   return item.AccountNumber !== undefined;
    // });
    context.log('mappedActRev ' + JSON.stringify(mappedActRev));

    // NOW WE HAVE OUR REVENUE ARRAY
    let revenue = mappedActRev;

    // NOW THAT WE HAVE OUR REVENUE ARRAY, WE NEED TO MERGE IT INTO OUR CREDITOR INVOICE LINE ITEMS
    flattenedCreditorInvoiceDetails.map(item1 => {
      return Object.assign(
        item1,
        revenue.find(item2 => {
          return item2 && item1.ActivityId === item2.ActivityId;
        })
      );
    });

    // THEN WE CAN OUTPUT THIS INTO THE FORMAT WE NEED
    let creditorInvoiceDetails = flattenedCreditorInvoiceDetails.map(i => {
      return {
        Id: i.Id,
        VoucherNumber: i.VoucherNumber,
        Description: i.Comment,
        Quantity: 1,
        UnitAmount: i.NetAmount,
        TaxAmount: i.VATAmount,
        AccountCode: i.AccountNumber
      };
    });

    // NOW WE CAN MERGE OUR CREDITOR INVOICE LINE ITEMS INTO A SUB ARRAY WITHIN OUR PARENT CREDITOR INVOICES

    const joinCreditorInvoicesWithDetails = creditorInvoices.map(
      creditorInvoice => {
        creditorInvoice.LineItems = creditorInvoiceDetails.filter(
          line => line.VoucherNumber === creditorInvoice.VoucherNumber
        );
        return creditorInvoice;
      }
    );

    // NOW WE CAN MERGE OUR CURRENY DATA INTO OUR MAIN DATA
    let mappedCurrencies = joinCreditorInvoicesWithDetails.map(item1 => {
      return Object.assign(
        item1,
        currencies.find(item2 => {
          return item2 && item1.CurrencyId === item2.Id;
        })
      );
    });

    // NOW WE CAN MERGE OUR SUPPLIER DATA INTO OUR MAIN DATA
    let mappedVevdors = mappedCurrencies.map(item1 => {
      return Object.assign(
        item1,
        vendors.find(item2 => {
          return item2 && item1.VendorId === item2.Id;
        })
      );
    });

    // NOW WE CAN FINALIZE THE ABOVE INTO THE FORMAT WE NEED
    let creditorInvoicesFormatted = mappedVevdors.map(i => {
      return {
        Type: 'ACCPAY',
        Contact: {
          Name: i.Name
        },
        Date: i.Date,
        DueDate: i.InvoiceDueDate,
        Reference: i.Reference,
        Total: i.Total,
        CurrencyCode: i.IsoCode,
        LineAmountTypes: 'Exclusive',
        LineItems: i.LineItems,
        InvoiceNumber: i.InvoiceNumber,
        Id: i.CreditorInvoiceId
      };
    });

    context.res = {
      status: 200,
      body: creditorInvoicesFormatted
    };
  } catch (e) {
    console.log(e);
    context.res = {
      status: 200,
      body: '9'
    };
  }
};
