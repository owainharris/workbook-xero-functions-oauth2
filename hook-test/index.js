const axios = require("axios");
module.exports = async function(context, req) {
  context.log("REQ INFO " + JSON.stringify(req));

  const baseURL = req.headers.baseurl;
  const id = req.body.Id;
  const auth = req.headers.auth;
  const nuintyAuth = req.headers.nuintyauth;
  const nuityBaseURL = req.headers.nuitybaseurl;
  const creditorEndPoint = `/api/finance/account/creditor/${id}`;
  const proxyURL = "https://immense-shore-64867.herokuapp.com/";
  const nuityEndPoint = "/api/creditors/save";

  const headers = {
    headers: {
      Authorization: `${auth}`,
      Accept: "application/json",
      "Content-type": "application/json",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Origin": "*",
      "X-Requested-With": "application/json"
    }
  };

  const nuityHeaders = {
    headers: {
      Authorization: `${nuintyAuth}`,
      Accept: "application/json",
      "Content-type": "application/json"
    }
  };

  // GET CREDITOR DATA IN WORKBOOK BY ID
  const creditorResult = await axios.get(
    proxyURL + baseURL + creditorEndPoint,
    headers
  );

  context.log("WB Response: " + creditorResult);

  // PUT RETURNED CREDITOR OBJECT INTO AN ARRAY SO WE CAN USE THE MAP METHOD
  let creditorResultArray = [];
  creditorResultArray.push(creditorResult.data);

  context.log("ARRAY: " + creditorResultArray);

  //CREATE CREITOR MODEL TO POST IN NUINTY
  const creditorModel = creditorResultArray.map(i => {
    return {
      creditorNumber: i.Id,
      mediaType: "5",
      mediaClass: "50",
      countryCode: "AUS",
      mediaState: "02",
      marketCode: "S",
      name: i.Name,
      addressLine1: i.Address1,
      addressLine2: "Test address 2",
      addressLine3: "Test address 3",
      addressLine4: "Test address 4",
      postCode: "2000",
      contactName: "Joe Bloggs",
      telNumber: "02123456",
      emailAddress: "aaa@bbb.com",
      creditorClass: "1",
      currencyCode: "AUD",
      gstStatus: "E",
      taxIdentificationNumber: "77777",
      withholdingTaxCode: "C100",
      netOrGrossFlag: "G",
      abnNumber: "",
      defaultDiscountPercent: 5.5,
      defaultCommissionPercent: 6.6
    };
  });

  const postToNuity = await axios.post(
    "https://" + nuityBaseURL + nuityEndPoint,
    JSON.stringify(creditorModel),
    nuityHeaders
  );
  context.log("Nuity Response: " + JSON.stringify(postToNuity));
};
