const https = require('https');

const RAILWAY_TOKEN = 'b8fe8375-77b5-4975-b361-b639bf82b4b2';
const SERVICE_ID = '65ced2fe-8683-47a9-84ff-aa2285961b78';
const ENV_ID = '562cd5f6-f4c5-442e-8ba9-7293c5f1d2a4';

function gql(query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const options = {
      hostname: 'backboard.railway.app',
      path: '/graphql/v2',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + RAILWAY_TOKEN,
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  // Get service instance info including startCommand
  console.log('=== Service Instance Info ===');
  const res = await gql(`
    query {
      serviceInstance(serviceId: "${SERVICE_ID}", environmentId: "${ENV_ID}") {
        id
        startCommand
        healthcheckPath
        numReplicas
        sleepApplication
        restartPolicyType
      }
    }
  `);
  console.log(JSON.stringify(res, null, 2));

  // Get environment variables to check what's set
  console.log('\n=== Environment Variables ===');
  const varRes = await gql(`
    query {
      variables(
        projectId: "e707c8f3-88e3-4f19-95b8-6c5e11cb424d"
        serviceId: "${SERVICE_ID}"
        environmentId: "${ENV_ID}"
      )
    }
  `);
  console.log(JSON.stringify(varRes, null, 2));
}

main().catch(console.error);
