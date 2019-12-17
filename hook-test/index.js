const axios = require("axios");
module.exports = async function(context, req) {
  context.log("REQ INFO " + JSON.stringify(req));

  const baseURL = req.headers.baseurl;
  const id = req.body.Id;
  const auth = req.headers.auth;
  const jobEndPoint = `/api/job/${id}`;
  const proxyURL = "https://immense-shore-64867.herokuapp.com/";

  const headers = {
    headers: {
      Authorization: `${auth}`,
      Accept: "application/json",
      "Content-type": "application/json"
      // "Access-Control-Allow-Credentials": "true",
      // "Access-Control-Allow-Origin": "*",
      // "X-Requested-With": "application/json"
    }
  };

  let jobResult = await axios.get(baseURL + jobEndPoint, headers);

  context.log(JSON.stringify("Job Result " + jobResult));

  const JobTypeId = jobResult.data.JobTypeId;
  const jobStatusEndPoint = `/api/settings/job/type/${JobTypeId}`;

  let jobStatusResult = await axios.get(
    proxyURL + baseURL + jobStatusEndPoint,
    headers
  );

  jobStatusResult.data.Name === "Media"
    ? context.log("IT IS MEDIA, LET's DO STUFF AND POST TO NUNITY!")
    : context.log("NOT A MEDIA JOB, DO NOTHING");
};
