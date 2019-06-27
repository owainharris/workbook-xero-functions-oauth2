const axios = require("axios");
const addDays = require("date-fns/add_days");
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

  try {
    const res = await axios.get(
      `https://immense-shore-64867.herokuapp.com/${baseURL}/api/job/purchases`,
      {
        headers: {
          Authorization: `Basic ${encoded}`,
          Accept: "application/json",
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Origin": "gzip*",
          "X-Requested-With": "application/json"
        }
      }
    );

    if (res.data.length === 0) {
      context.res = {
        status: 200,
        body: "none"
      };
    }

    let parentPurchases = await res.data.filter(i => i.Status === 40);

    if (parentPurchases.length === 0) {
      context.res = {
        status: 200,
        body: "none"
      };
    }

    const supplierIds = parentPurchases
      .filter(purchase => purchase.Status === 40)
      .map(purchase => purchase.VendorResourceId);

    const suppliersArr = supplierIds.map(async ids => {
      const response = await axios.get(
        `https://immense-shore-64867.herokuapp.com/${baseURL}/api/resource/${ids}`,
        {
          headers: {
            Authorization: `Basic ${encoded}`,
            Accept: "application/json",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Origin": "gzip",
            "X-Requested-With": "application/json"
          }
        }
      );
      return response.data;
    });

    const suppliers = await Promise.all(suppliersArr);

    const supplierCodes = suppliers.map(item => {
      return {
        supplierId: item.Id,
        externalCode: item.ExternalCode
      };
    });

    let joinSuppliers = parentPurchases.map(item1 => {
      return Object.assign(
        item1,
        supplierCodes.find(item2 => {
          return item2 && item1.VendorResourceId === item2.supplierId;
        })
      );
    });

    const purchAndSupp = joinSuppliers
      .filter(item => item.Status === 40)
      .map(item => {
        let DeliveryDate = "";
        if (item.DeliveryDate === undefined || item.DeliveryDate === null) {
          DeliveryDate = addDays(Date.now(), 30);
        } else {
          DeliveryDate = item.DeliveryDate;
        }
        return {
          PurchaseOrderNumber: item.Id,
          Total: item.Cost,
          Date: item.Date,
          DeliveryDate: DeliveryDate,
          Reference: item.Title,
          Contact: { ContactID: item.externalCode },
          Status: "DRAFT",
          LineAmountTypes: "Exclusive",
          LineItems: [],
          Id: item.Id
        };
      });
    let purchases = await purchAndSupp;

    const purchaseIds = parentPurchases
      .filter(purchase => purchase.Status === 40)
      .map(purchase => purchase.Id);

    const getActivities = await axios.get(
      `https://immense-shore-64867.herokuapp.com/${baseURL}/api/core/activities/company`,
      {
        headers: {
          Authorization: `Basic ${encoded}`,
          Accept: "application/json",
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Origin": "gzip",
          "X-Requested-With": "application/json"
        }
      }
    );
    let actResults = await getActivities.data;

    let revenueIds = actResults
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
        {
          headers: {
            Authorization: `Basic ${encoded}`,
            Accept: "application/json",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Origin": "gzip",
            "X-Requested-With": "application/json"
          }
        }
      );
      return response.data;
    });
    const revenueAccounts = await Promise.all(revenueAccountsArr);

    let flattenedRevenue = actResults.map(item1 => {
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

    let revenue = await mappedActRev;

    const purchaseLinesArr = purchaseIds.map(async ids => {
      const response = await axios.get(
        `https://immense-shore-64867.herokuapp.com/${baseURL}/api/purchase/${ids}/details`,
        headers
      );
      return response.data;
    });
    const purchaseLines = await Promise.all(purchaseLinesArr);
    const flattenedPurchaseLines = [].concat(...purchaseLines);

    let purchaseLinesJoined = flattenedPurchaseLines.map(item1 => {
      return Object.assign(
        item1,
        revenue.find(item2 => {
          return item2 && item1.ActivityId === item2.ActivityId;
        })
      );
    });
    let purchaseMapXero = purchaseLinesJoined.map(i => {
      if (i.Unit === undefined) {
        i.Unit = 0;
      }
      if (i.UnitCost === undefined) {
        i.UnitCost = 0;
      }
      if (i.Quantity === undefined) {
        i.Quantity = 0;
      }

      return {
        Id: i.Id,
        PurchaseId: i.PurchaseId,
        Description: i.Subject,
        Quantity: i.Unit,
        UnitAmount: i.UnitCost,
        AccountCode: i.AccountNumber
      };
    });
    purchaseMapXero = purchaseLinesJoined.map(i => {
      if (i.Subject === undefined) {
        i.Subject = "N/A";
      }
      return {
        Id: i.Id,
        PurchaseId: i.PurchaseId,
        Description: i.Subject,
        Quantity: i.Unit,
        UnitAmount: i.UnitCost,
        AccountCode: i.AccountNumber
      };
    });

    const purchasesToPostJoin = purchases.map(purchase => {
      purchase.LineItems = purchaseMapXero.filter(
        line => line.PurchaseId === purchase.PurchaseOrderNumber
      );
      return purchase;
    });
    let purchasesToPost = purchasesToPostJoin.filter(
      po => po.Contact.ContactID !== undefined
    );

    // Return data once processed
    context.res = {
      status: 200,
      body: purchasesToPost
    };
    return purchasesToPost;
  } catch (e) {
    context.log(e);
    context.res = {
      status: 200,
      body: "9"
    };
  }
};
