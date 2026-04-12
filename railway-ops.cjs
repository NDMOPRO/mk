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
  const action = process.argv[2] || 'status';

  if (action === 'status') {
    // Get latest deployments for the service
    console.log('=== Checking deployment status ===');
    const res = await gql(`
      query {
        deployments(
          input: { projectId: "${PROJECT_ID}", serviceId: "${SERVICE_ID}" }
          first: 3
        ) {
          edges {
            node {
              id
              status
              createdAt
              updatedAt
              url
            }
          }
        }
      }
    `);
    console.log(JSON.stringify(res, null, 2));
  }

  if (action === 'envs') {
    // Get current environment variables
    console.log('=== Getting environment variables ===');
    // First get the environment ID
    const envRes = await gql(`
      query {
        project(id: "${PROJECT_ID}") {
          environments {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      }
    `);
    console.log(JSON.stringify(envRes, null, 2));
  }

  if (action === 'setenv') {
    // First get the environment ID
    const envRes = await gql(`
      query {
        project(id: "${PROJECT_ID}") {
          environments {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      }
    `);
    const envId = envRes.data.project.environments.edges[0].node.id;
    console.log('Environment ID:', envId);

    // Set ADMIN_USERNAME variable
    const setRes = await gql(`
      mutation {
        variableUpsert(input: {
          projectId: "${PROJECT_ID}",
          serviceId: "${SERVICE_ID}",
          environmentId: "${envId}",
          name: "ADMIN_USERNAME",
          value: "Monthlykey,hobart2007"
        })
      }
    `);
    console.log('Set ADMIN_USERNAME result:', JSON.stringify(setRes, null, 2));
  }

  if (action === 'redeploy') {
    // Get latest deployment ID first
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
            }
          }
        }
      }
    `);
    console.log('Latest deployment:', JSON.stringify(depRes, null, 2));

    const latestDepId = depRes.data.deployments.edges[0]?.node?.id;
    if (!latestDepId) {
      console.log('No deployment found to redeploy');
      return;
    }

    // Redeploy
    const redeployRes = await gql(`
      mutation {
        deploymentRedeploy(id: "${latestDepId}")
      }
    `);
    console.log('Redeploy result:', JSON.stringify(redeployRes, null, 2));
  }
}

main().catch(console.error);
