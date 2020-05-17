const axios = require("axios");

module.exports = async function(connections, auth, invoices) {
  try {
    const invoiceDetailsArr = await invoices.data.map(async id => {
      const invoiceDetailsURL = `api/finance/debtor/invoicemanagement/${id}`;
      const res = await axios.get(
        `https://immense-shore-64867.herokuapp.com/` +
          `${connections.baseURL}` +
          "/" +
          `${invoiceDetailsURL}`,
        { headers: auth.get_headers }
      );
      return res.data;
    });

    const invoiceDetailsResponse = await Promise.all(invoiceDetailsArr);

    console.log("invoiceDetailsResponse")

    // FILTER OUT ALL CREDIT NOTES
    const filteredCreditNotes = invoiceDetailsResponse.filter(
      i => i.InvoiceType !== 2
    );

    //console.log("filteredCreditNotes " + JSON.stringify(filteredCreditNotes))

    const flattenedinvoiceDetails = [].concat(...filteredCreditNotes);

    //console.log("flattenedinvoiceDetails " + flattenedinvoiceDetails)

    // REDUCE CUSTOMER IDs SO WE CAN LOOP AND GET EXTERNAL IDs
    let customerIds = flattenedinvoiceDetails.map(i => i.CustomerId);
    console.log("customerIds " + JSON.stringify(customerIds))

    let removeDuplicates = [...new Set(customerIds)];
    console.log("removeDuplicates " + JSON.stringify(removeDuplicates))

    // LOOP THROUGH CUSTOMER IDs TO GRAB EXTERNAL CODE
    const customerDetailsArr = await removeDuplicates.map(async id => {
      const invoiceDetailsURL = `api/Resource/customer/${id}`;
      const res = await axios.get(
        `https://immense-shore-64867.herokuapp.com/` +
          `${connections.baseURL}` +
          "/" +
          `${invoiceDetailsURL}`,
        { headers: auth.get_headers }
      );
      return res.data;
    });

    const customerDetailsResponse = await Promise.all(customerDetailsArr);

    console.log("customerDetailsResponse" + JSON.stringify(customerDetailsResponse))

    const flattenedCustomerDetails = [].concat(...customerDetailsResponse).filter(i => i.ExternalCode !== undefined);

    console.log("flattenedCustomerDetails " + flattenedCustomerDetails) 

    // REDUCE CUSTOMERS TO ID AND EXTERNAL CODE
    const reducedCustomers = flattenedCustomerDetails.map(i => {
      return {
        CustomerId: i.Id,
        ExternalCode: i.ExternalCode
      }
    })

    console.log("reducedCustomers " + reducedCustomers)

    // MERGE INVOICE DETAILS AND CUSTOMERS TO JOIN EXTENRAL CODE
    const externalCodeMerged = flattenedinvoiceDetails.map(item1 => {
      return Object.assign(
        item1,
        reducedCustomers.find(item2 => {
          return item2 && item1.CustomerId === item2.CustomerId;
        })
      );
    });

    console.log("externalCodeMerged " + externalCodeMerged)


    let invoiceDetails = externalCodeMerged.map(i => {
      return {
        Type: "ACCREC",
        Total: i.AmountTotalCurrency,
        Contact: {
          Name: i.CustomerName,
          ExternalCode: i.ExternalCode
        },
        Date: i.InvoiceDate,
        DueDate: i.InvoiceDueDate,
        LineAmountTypes: "Exclusive",
        Reference: "Id: " + i.Id + ", " + "Job: " + i.JobName,
        CurrencyCode: i.CurrencyCode,
        Status: "DRAFT",
        LineItems: {},
        Id: i.Id,
        InvoiceNumber: i.InvoiceNumber
      };
    });

    return invoiceDetails;
  } catch (e) {
    console.log(e);
  }
};
