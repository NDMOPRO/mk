const https = require('https');

const RAILWAY_TOKEN = 'b8fe8375-77b5-4975-b361-b639bf82b4b2';
const PROJECT_ID = 'e707c8f3-88e3-4f19-95b8-6c5e11cb424d';
const SERVICE_ID = '65ced2fe-8683-47a9-84ff-aa2285961b78';
const DEPLOYMENT_ID = 'db29f603-edfa-46bd-bd24-097b3a9f7934'; // latest SUCCESS deployment

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
  // Try to get deployment logs
  console.log('Fetching deployment logs...');
  const res = await gql(`
    query {
      deploymentLogs(deploymentId: "${DEPLOYMENT_ID}", limit: 100) {
        timestamp
        message
        severity
      }
    }
  `);
  
  if (res.data && res.data.deploymentLogs) {
    const logs = res.data.deploymentLogs;
    console.log('Got', logs.length, 'log entries:');
    logs.forEach(l => {
      console.log(`[${l.severity}] ${l.timestamp}: ${l.message}`);
    });
  } else {
    console.log('Response:', JSON.stringify(res, null, 2));
    
    // Try alternative log query
    console.log('\nTrying buildLogs...');
    const res2 = await gql(`
      query {
        buildLogs(deploymentId: "${DEPLOYMENT_ID}", limit: 100) {
          timestamp
          message
          severity
        }
      }
    `);
    console.log('buildLogs response:', JSON.stringify(res2, null, 2));
  }
}

main().catch(console.error);
