const axios = require("axios");

module.exports = async function (connections, auth, invoices) {
  try {
    const invoiceLinesArr = await invoices.data.map(async (id) => {
      const invoiceLinesURL = `api/invoice/${id}/lines`;
      const res = await axios.get(
        `https://immense-shore-64867.herokuapp.com/` +
          `${connections.baseURL}` +
          "/" +
          `${invoiceLinesURL}`,
        { headers: auth.get_headers }
      );
      return res.data;
    });

    const invoiceLinesResponse = await Promise.all(invoiceLinesArr);
    const flattenedinvoiceLines = [].concat(...invoiceLinesResponse);
    let invoiceLines = flattenedinvoiceLines.map((i) => {
      let lineDesc =
        i.Description === undefined || i.Description === ""
          ? "N/A"
          : i.Description;
      return {
        Id: i.Id,
        InvoiceId: i.InvoiceId,
        Description: lineDesc,
        Quantity: 1,
        UnitAmount: i.AmountNetCurrency,
        TaxAmount: i.AmountVATCurrency,
        ActivityId: i.ActivityId,
      };
    });

    console.log("GOT LINES");

    return invoiceLines;
  } catch (e) {
    console.log(e);
  }
};
