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

    // FILTER OUT ALL CREDIT NOTES
    const filteredCreditNotes = invoiceDetailsResponse.filter(
      i => i.InvoiceType !== 2
    );

    const flattenedinvoiceDetails = [].concat(...filteredCreditNotes);
    let invoiceDetails = flattenedinvoiceDetails.map(i => {
      return {
        Type: "ACCREC",
        Total: i.AmountTotalCurrency,
        Contact: {
          Name: i.CustomerName
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
