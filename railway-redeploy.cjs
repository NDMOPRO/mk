const https = require('https');

const RAILWAY_TOKEN = 'b8fe8375-77b5-4975-b361-b639bf82b4b2';
const PROJECT_ID = 'e707c8f3-88e3-4f19-95b8-6c5e11cb424d';
const SERVICE_ID = '65ced2fe-8683-47a9-84ff-aa2285961b78';

function gql(query, variables) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
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
  // Step 1: Get latest deployment ID
  console.log('Step 1: Getting latest deployment ID...');
  const depRes = await gql(`
    query {
      deployments(
        input: { projectId: "${PROJECT_ID}", serviceId: "${SERVICE_ID}" }
        first: 1
      ) {
        edges {
          node {
            id
            status
            createdAt
          }
        }
      }
    }
  `);

  const latestDep = depRes.data.deployments.edges[0]?.node;
  if (!latestDep) {
    console.log('No deployment found');
    return;
  }
  console.log('Latest deployment:', latestDep.id, 'Status:', latestDep.status);

  // Step 2: Redeploy with proper subfield selection
  console.log('\nStep 2: Triggering redeploy...');
  const redeployRes = await gql(`
    mutation {
      deploymentRedeploy(id: "${latestDep.id}") {
        id
        status
      }
    }
  `);
  console.log('Redeploy result:', JSON.stringify(redeployRes, null, 2));

  if (redeployRes.data && redeployRes.data.deploymentRedeploy) {
    const newDep = redeployRes.data.deploymentRedeploy;
    console.log('\n✅ Redeploy triggered! New deployment ID:', newDep.id, 'Status:', newDep.status);
    console.log('Waiting 30 seconds for deployment to complete...');

    // Wait 30 seconds then check status
    await new Promise(r => setTimeout(r, 30000));

    const checkRes = await gql(`
      query {
        deployments(
          input: { projectId: "${PROJECT_ID}", serviceId: "${SERVICE_ID}" }
          first: 1
        ) {
          edges {
            node {
              id
              status
              updatedAt
            }
          }
        }
      }
    `);
    const latest = checkRes.data.deployments.edges[0]?.node;
    console.log('\nDeployment status after 30s:', latest?.status);
    return latest;
  } else {
    console.log('Redeploy failed:', JSON.stringify(redeployRes, null, 2));
  }
}

main().catch(console.error);
