const fs = require('fs-extra');
const path = require('path');

async function generateScriptsStructure(projectPath, config) {
  const scriptsDir = path.join(projectPath, 'scripts', 'twilioInit');
  const servicesDir = path.join(scriptsDir, 'services');
  const helpersDir = path.join(scriptsDir, 'helpers');
  
  // Create directories
  await fs.ensureDir(scriptsDir);
  await fs.ensureDir(servicesDir);
  await fs.ensureDir(helpersDir);

  // Generate index.ts
  const indexTemplate = `// External npm packages
import 'dotenv/config';
import twilio from 'twilio';

// Local imports
import { assignPhoneNumber } from './services/assignPhoneNumber';
import createConversationalIntelligence from './services/createConversationalIntelligence';
import { createMessagingService } from './services/createMessagingService';
import { createTaskRouterService } from './services/createTaskRouter';
import { log } from '../../src/lib/utils/logger';

// Main deployment script that orchestrates the creation of services needed.
async function twilioInit() {
  // Validate environment variables
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    throw new Error(
      'Missing required environment variables. Please check .env file.'
    );
  }

  log.lightPurple({
    label: 'deployment',
    message: '=== Deployment Started 🚀 ===',
  });

  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  try {
    log.brightCyan({
      label: 'deployment',
      message: 'Step 1: Deploy Task Router Service...',
    });
    const taskRouterService = await createTaskRouterService(client);

    log.brightCyan({
      label: 'deployment',
      message: '\\nStep 2: Assign Phone Number...',
    });
    const phoneNumberData = await assignPhoneNumber(client);

    log.brightCyan({
      label: 'deployment',
      message: '\\nStep 3: Create Messaging Service...',
    });
    const messagingService = await createMessagingService(
      client,
      phoneNumberData.conversationNumber
    );

    // Step 4: Create the Voice Intelligence Service
    log.brightCyan({
      label: 'deployment',
      message: '\\nStep 4: Create Conversational Intelligence Service...',
    });
    const conversationIntelligenceService =
      await createConversationalIntelligence(client);

    // Deployment summary
    log.lightPurple({
      label: 'deployment',
      message: '\\n=== Deployment Summary  🎉 ===',
    });
    log.lightBlue({
      label: 'deployment',
      message: 'TaskRouter Workspace SID:',
      data: taskRouterService.workspace?.sid,
    });
    log.lightBlue({
      label: 'deployment',
      message: 'TaskRouter TaskQueue SID:',
      data: taskRouterService.taskQueue?.sid,
    });
    log.lightBlue({
      label: 'deployment',
      message: 'TaskRouter Workflow SID:',
      data: taskRouterService.workflow?.sid,
    });
    log.lightBlue({
      label: 'deployment',
      message: 'Conversation Phone Number:',
      data: phoneNumberData.conversationNumber,
    });
    log.lightBlue({
      label: 'deployment',
      message: 'Messaging Service SID:',
      data: messagingService.accountSid,
    });
    log.lightBlue({
      label: 'deployment',
      message: 'Messaging Service Name:',
      data: messagingService.friendlyName,
    });
    log.lightBlue({
      label: 'deployment',
      message: 'Conversational Intelligence Service SID:',
      data: conversationIntelligenceService.serviceSid,
    });
  } catch (error: any) {
    console.error('\\n❌ Deployment failed:');
    console.error('Error:', error.message);

    if (error.code) {
      console.error('Error Code:', error.code);
    }
    if (error.status) {
      console.error('Status Code:', error.status);
    }

    console.log('\\nTroubleshooting suggestions:');
    console.log('1. Check your Twilio credentials');
    console.log('2. Verify your account has AI Assistant access');
    console.log('3. Ensure all webhook URLs are valid');
    console.log('4. Check for any duplicate resource names');

    // Close readline interface
    throw error;
  }
}

// Add cleanup function for handling interruptions
process.on('SIGINT', async () => {
  console.log('\\n\\nReceived interrupt signal. Cleaning up...');
  process.exit(0);
});

// Run the deployment if this script is executed directly
if (require.main === module) {
  twilioInit()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\\nDeployment failed. See error details above.');
      process.exit(1);
    });
}

export default twilioInit;
`;

  await fs.writeFile(path.join(scriptsDir, 'index.ts'), indexTemplate);

  // Generate assignPhoneNumber.ts
  const assignPhoneNumberTemplate = `// External npm packages
import twilio from 'twilio';
import dotenv from 'dotenv';

// Local imports
import { log } from '../../../src/lib/utils/logger';
import { updateEnvFile } from '../helpers/updateEnvFile';
import { routeNames } from '../../../src/routes/routeNames';

export async function assignPhoneNumber(client: any) {
  dotenv.config();
  const env = process.env.NODE_ENV;
  const isProduction = env === 'production';
  let functionsDomain = process.env.NGROK_URL;
  if (isProduction && process.env.LIVE_HOST_URL) {
    functionsDomain = process.env.LIVE_HOST_URL;
  }

  const voiceUrl = \`https://\${functionsDomain}/\${routeNames.call}\`;
  const smsUrl = \`https://\${functionsDomain}/\${routeNames.sms}\`;

  const phoneConfig = {
    voiceMethod: 'GET',
    voiceUrl,
    smsMethod: 'POST',
    smsUrl,
  };

  let conversationNumber = process.env.TWILIO_CONVERSATION_NUMBER;

  try {
    // Check if we need to purchase a new number or use the existing one
    if (!conversationNumber) {
      log.info({
        label: 'assignPhoneNumber',
        message:
          'No TWILIO_CONVERSATION_NUMBER found. Searching for toll-free number...',
      });

      // Get available toll-free numbers and purchase one if available
      const availableNumbers = await client
        .availablePhoneNumbers('US')
        .tollFree.list({ limit: 1 });
      if (!availableNumbers.length)
        throw new Error('No toll-free numbers available.');

      const newNumber = availableNumbers[0].phoneNumber;
      log.info({
        label: 'assignPhoneNumber',
        message: \`Purchasing toll-free number: \${newNumber}\`,
      });

      const purchased = await client.incomingPhoneNumbers.create({
        phoneNumber: newNumber,
        ...phoneConfig,
      });

      log.green({
        label: 'assignPhoneNumber',
        message: 'Purchased number and configured',
        data: purchased.phoneNumber,
      });
      conversationNumber = purchased.phoneNumber;
    } else {
      log.info({
        label: 'assignPhoneNumber',
        message: \`Existing number found: \${conversationNumber}\`,
      });

      // Ensure the number exists in Twilio account
      const incomingNumbers = await client.incomingPhoneNumbers.list({
        phoneNumber: conversationNumber,
      });
      if (!incomingNumbers.length) {
        throw new Error(
          \`Could not find configured number \${conversationNumber} in your Twilio account.\`
        );
      }

      // Update the existing number's voice URL and method
      const numberSid = incomingNumbers[0].sid;
      await client.incomingPhoneNumbers(numberSid).update({
        ...phoneConfig,
      });

      log.green({
        label: 'assignPhoneNumber',
        message: \`Updated \${conversationNumber} to use voiceUrl \${voiceUrl}\`,
      });
      log.yellow({
        label: 'assignPhoneNumber',
        message: \`Don't forget to ensure the number is Toll Free Verified in the Console - SMS wont work until then!\`,
      });

      // If you try to deploy the Twilio assets first,
      // you'll need to make sure to update the phone numbers webhook url to point to the hosted route.
      // You should deploy the app first then run this but we are safeguarding for those who ignore the readme
      // or are wanting to test locally with a deployed phone number.
      if (functionsDomain === process.env.NGROK_URL) {
        log.yellow({
          label: 'assignPhoneNumber',
          message: \`It looks like you are using ngrok on your deployed phone number - 
          don't forget to update the connection in the console when you want to go live:
          https://console.twilio.com/us1/develop/phone-numbers/manage/incoming/\${numberSid}/configure\`,
        });
      }
      if (!process.env.NGROK_URL) {
        log.yellow({
          label: 'assignPhoneNumber',
          message: \`Once app is deployed, update LIVE_HOST_URL env var in local and deployed files.\`,
        });
      }
    }

    // Save the assigned phone number to the .env file
    if (conversationNumber) {
      await updateEnvFile('TWILIO_CONVERSATION_NUMBER', conversationNumber);
    }
    return {
      conversationNumber,
    };
  } catch (error) {
    log.error({
      label: 'assignPhoneNumber',
      message: 'Error assigning phone number',
      data: error,
    });
    throw error;
  }
}
`;

  await fs.writeFile(path.join(servicesDir, 'assignPhoneNumber.ts'), assignPhoneNumberTemplate);

  // Generate createConversationalIntelligence.ts
  const createConversationalIntelligenceTemplate = `// External npm packages
import twilio from 'twilio';
import dotenv from 'dotenv';

// Local imports
import { log } from '../../../src/lib/utils/logger';
import { updateEnvFile } from '../helpers/updateEnvFile';
import { kebab } from '../helpers/kebab';
import { ServiceInstance } from 'twilio/lib/rest/intelligence/v2/service';

const OPERATOR_CONFIGS = {
  callScoring: {
    config: {
      prompt: \`Use the following parameters to evaluate the phone call between the agent and the customer. 
      Assign scores (1 to 5) to each KPI and provide comments to justify the score. 
      Each KPI assesses the agent's performance in various aspects of the call.
      1. Greeting & Professionalism: Was the agent friendly, clear, and professional? (1–5)
      2. Listening & Empathy: Did the agent actively listen and show empathy? (1–5)
      3. Communication & Clarity: Was the information clear and easy to understand? (1–5)
      4. Problem-Solving: Did the agent resolve the issue efficiently? (1–5)
      5. Overall Experience: Was the customer satisfied, and was the call handled well? (1–5)\`,
      json_result_schema: {
        type: 'object',
        properties: {
          greeting_professionalism: { type: 'integer' },
          listening_empathy: { type: 'integer' },
          communication_clarity: { type: 'integer' },
          problem_solving: { type: 'integer' },
          overall_experience: { type: 'integer' },
        },
      },
      examples: [],
    },
    friendlyName: 'CallScoring',
    operatorType: 'GenerativeJSON' as const,
  },
  competitiveEscalation: {
    config: {
      prompt: \`Use the following parameters to evaluate the phone call between the agent and the customer. 
      Answer following questions based on the transcript. 
      1. Competitor Mentions: Did the customer mention any competitors during the call? (Yes/No)
      2. Objections Raised: Did the customer express dissatisfaction, concerns, or objections related to the product/service or pricing? (Yes/No)
      3. Agent's Response to Objections: How effectively did the agent address the customer's objections or concerns? (1–5)
      4. Escalation Need: Does the call indicate a need for escalation (e.g., customer dissatisfaction, unresolved issue)? (Yes/No)
      5. Next Best Action: Based on the call, what is the recommended next step for the agent (e.g., follow-up call, transfer to sales, offer a discount)? (String)\`,
      json_result_schema: {
        type: 'object',
        properties: {
          competitor_mentions: { type: 'boolean' },
          objections_raised: { type: 'boolean' },
          agent_response_to_objections_score: { type: 'integer' },
          escalation_needed: { type: 'boolean' },
          next_best_action: { type: 'string' },
        },
      },
      examples: [],
    },
    friendlyName: 'CompetitiveEscalation',
    operatorType: 'GenerativeJSON' as const,
  },
} as const;

/**
 * Creates a Conversational Intelligence Service and attaches custom operators
 * @param {Client} Twilio - Twilio client instance
 */
async function createConversationalIntelligence(client: any): Promise<{
  serviceSid: string;
  callScoringOperatorSid: string;
  competitiveEscalationOperatorSid: string;
}> {
  dotenv.config();
  try {
    const serviceUniqueName = \`conversational-intelligence-\${kebab(
      process.env.SERVICE_NAME ?? 'default'
    )}\`;

    // Check if service already exists
    const existingServices = await client.intelligence.v2.services.list();
    const existingService = existingServices.find(
      (s: any) => s.uniqueName === serviceUniqueName
    );

    let service: ServiceInstance;
    if (existingService) {
      log.info({
        label: 'createConversationalIntelligence',
        message: 'Existing Conversational Intelligence Service found',
        data: existingService.sid,
      });
      service = existingService;
    } else {
      log.info({
        label: 'createConversationalIntelligence',
        message: 'Creating new Conversational Intelligence Service...',
      });
      // Create the service
      service = await client.intelligence.v2.services.create({
        uniqueName: serviceUniqueName,
      });
      log.green({
        label: 'createConversationalIntelligence',
        message: 'Conversational Intelligence Service created successfully',
        data: service.sid,
      });
    }

    // Check for existing operators
    const existingOperators =
      await client.intelligence.v2.customOperators.list();
    let callScoringOperator = existingOperators.find(
      (op: any) => op.friendlyName === OPERATOR_CONFIGS.callScoring.friendlyName
    );
    let competitiveEscalationOperator = existingOperators.find(
      (op: any) =>
        op.friendlyName === OPERATOR_CONFIGS.competitiveEscalation.friendlyName
    );

    // Create first custom operator for call scoring if it doesn't exist
    if (!callScoringOperator) {
      log.info({
        label: 'createConversationalIntelligence',
        message: 'Creating Call Scoring operator...',
      });
      callScoringOperator = await client.intelligence.v2.customOperators.create(
        OPERATOR_CONFIGS.callScoring
      );
      log.green({
        label: 'createConversationalIntelligence',
        message: 'Call Scoring operator created successfully',
        data: callScoringOperator.sid,
      });

      // Attach first operator to service
      await client.intelligence.v2
        .operatorAttachment(service.sid, callScoringOperator.sid)
        .create();
      log.green({
        label: 'createConversationalIntelligence',
        message: 'Call Scoring operator attached successfully to service',
      });
    } else {
      log.info({
        label: 'createConversationalIntelligence',
        message: 'Existing Call Scoring operator found',
        data: callScoringOperator.sid,
      });
    }

    // Create second custom operator for competitive escalation if it doesn't exist
    if (!competitiveEscalationOperator) {
      log.info({
        label: 'createConversationalIntelligence',
        message: 'Creating Competitive Escalation operator...',
      });
      competitiveEscalationOperator =
        await client.intelligence.v2.customOperators.create(
          OPERATOR_CONFIGS.competitiveEscalation
        );
      log.green({
        label: 'createConversationalIntelligence',
        message: 'Competitive Escalation operator created successfully',
        data: competitiveEscalationOperator.sid,
      });

      // Attach second operator to service
      await client.intelligence.v2
        .operatorAttachment(service.sid, competitiveEscalationOperator.sid)
        .create();
      log.green({
        label: 'createConversationalIntelligence',
        message:
          'Competitive Escalation operator attached successfully to service',
      });
    } else {
      log.info({
        label: 'createConversationalIntelligence',
        message: 'Existing Competitive Escalation operator found',
        data: competitiveEscalationOperator.sid,
      });
    }

    // Save Conversational Intelligence Service SID to .env
    await updateEnvFile('TWILIO_CONVERSATIONAL_INTELLIGENCE_SID', service.sid);

    return {
      serviceSid: service.sid,
      callScoringOperatorSid: callScoringOperator.sid,
      competitiveEscalationOperatorSid: competitiveEscalationOperator.sid,
    };
  } catch (error) {
    log.error({
      label: 'createConversationalIntelligence',
      message: 'Failed to create Conversational Intelligence Service',
      data: error,
    });
    throw error;
  }
}

export default createConversationalIntelligence;
`;

  await fs.writeFile(path.join(servicesDir, 'createConversationalIntelligence.ts'), createConversationalIntelligenceTemplate);

  // Generate createMessagingService.ts
  const createMessagingServiceTemplate = `// External npm packages
import twilio from 'twilio';
import dotenv from 'dotenv';

// Local imports
import { log } from '../../../src/lib/utils/logger';
import { updateEnvFile } from '../helpers/updateEnvFile';

export async function createMessagingService(
  client: any,
  phoneNumber?: string
) {
  dotenv.config();
  const serviceName = process.env.SERVICE_NAME;
  const conversationNumber =
    phoneNumber || process.env.TWILIO_CONVERSATION_NUMBER;

  try {
    if (!serviceName || !conversationNumber) {
      throw new Error(
        'SERVICE_NAME or TWILIO_CONVERSATION_NUMBER is not set in the environment variables.'
      );
    }
    const messagingServiceName = \`\${serviceName} Messaging Service\`;
    // Step 1: Check if a Messaging Service already exists with the same name
    const services = await client.messaging.v1.services.list({ limit: 50 });

    let messagingService = services.find(
      (service: any) => service.friendlyName === messagingServiceName
    );

    // Step 2: Create a new Messaging Service using the v1 namespace
    if (!messagingService) {
      messagingService = await client.messaging.v1.services.create({
        friendlyName: messagingServiceName,
        ...({
          useInboundWebhookOnNumber: true,
        } as any),
      });
      log.green({
        label: 'createMessagingService',
        message: 'New messaging service created',
        data: \`\${messagingService.sid} - aka \${messagingService.friendlyName}\`,
      });
    } else {
      // Update existing service to use sender's webhook
      messagingService = await client.messaging.v1
        .services(messagingService.sid)
        .update({
          ...({
            useInboundWebhookOnNumber: true,
          } as any),
        });
      log.info({
        label: 'createMessagingService',
        message: 'Existing messaging service found',
        data: \`\${messagingService.sid} - aka \${messagingService.friendlyName}\`,
      });
    }
    if (messagingService) {
      // Save the assigned messaging to the .env file
      await updateEnvFile('TWILIO_MESSAGING_SERVICE_SID', messagingService.sid);
    }

    // Step 3: Attach conversation number to sender pool (if not already added)
    const phoneNumbers = await client.messaging.v1
      .services(messagingService.sid)
      .phoneNumbers.list();

    const isNumberAttached = phoneNumbers.some(
      (pn: any) => pn.phoneNumber === conversationNumber
    );

    if (!isNumberAttached) {
      const incomingPhoneNumbers = await client.incomingPhoneNumbers.list({
        phoneNumber: conversationNumber,
      });

      if (incomingPhoneNumbers.length === 0) {
        throw new Error(
          \`Phone number \${conversationNumber} not found in your Twilio account.\`
        );
      }

      await client.messaging.v1
        .services(messagingService.sid)
        .phoneNumbers.create({
          phoneNumberSid: incomingPhoneNumbers[0].sid,
        });

      log.green({
        label: 'createMessagingService',
        message: 'Attached phone number to messaging service',
        data: conversationNumber,
      });
    }

    // Step 4: Attach RCS to sender pool manually.
    log.yellow({
      label: 'createMessagingService',
      message: \`RCS isn't yet supported via API and requires manual enablement: 
      https://www.twilio.com/messaging/channels/rcs#request-access-form.\`,
    });
    log.yellow({
      label: 'createMessagingService',
      message: 'Use the Twilio Console to add the RCS sender to the service.',
    });

    const { accountSid, friendlyName } = messagingService;
    return { friendlyName, accountSid };
  } catch (error) {
    log.error({
      label: 'createMessagingService',
      message: 'Error assigning phone number',
      data: error,
    });
    throw error;
  }
}
`;

  await fs.writeFile(path.join(servicesDir, 'createMessagingService.ts'), createMessagingServiceTemplate);

  // Generate createTaskRouter.ts
  const createTaskRouterTemplate = `// External npm packages
import twilio from 'twilio';
import dotenv from 'dotenv';
import { WorkspaceInstance } from 'twilio/lib/rest/taskrouter/v1/workspace';
import { TaskQueueInstance } from 'twilio/lib/rest/taskrouter/v1/workspace/taskQueue';
import { WorkflowInstance } from 'twilio/lib/rest/taskrouter/v1/workspace/workflow';

// Local imports
import { log } from '../../../src/lib/utils/logger';
import { updateEnvFile } from '../helpers/updateEnvFile';

export async function createTaskRouterService(client: any): Promise<{
  workspace: WorkspaceInstance | null;
  taskQueue: TaskQueueInstance | null;
  workflow: WorkflowInstance | null;
}> {
  dotenv.config();
  const serviceName = process.env.SERVICE_NAME;

  try {
    // Step 1: Check if a workspace already exists
    const workspaceName = \`\${serviceName} TaskRouter Workspace\`;
    let workSpace: WorkspaceInstance | null = null;
    const workspaces = await client.taskrouter.v1.workspaces.list({ limit: 1 });

    if (workspaces.length > 0) {
      workSpace = workspaces[0];
      log.info({
        label: 'createTaskRouter',
        message: 'Existing workspace found',
        data: workSpace?.sid,
      });
    } else {
      // Create a new TaskRouter Workspace if none exists
      workSpace = await client.taskrouter.v1.workspaces.create({
        friendlyName: workspaceName,
      });
      log.green({
        label: 'createTaskRouter',
        message: 'New workspace created',
        data: workSpace?.sid,
      });
    }

    // Step 2: Check if a Task Queue with the same name already exists
    const taskQueueName = \`\${serviceName} Task Queue\`;
    let taskQueue: TaskQueueInstance | null = null;
    const taskQueues = await client.taskrouter.v1
      .workspaces(workSpace?.sid || '')
      .taskQueues.list();

    if (taskQueues.length > 0) {
      // If a queue exists with the exact name, use it
      taskQueue = taskQueues.find(
        (queue: any) => queue.friendlyName === taskQueueName
      )!;
      if (taskQueue) {
        log.info({
          label: 'createTaskRouter',
          message: 'Existing Task Queue found',
          data: taskQueue.sid,
        });
      }
    }
    // If no task queue with the name exists, create a new one
    if (!taskQueue) {
      taskQueue = await client.taskrouter.v1
        .workspaces(workSpace?.sid || '')
        .taskQueues.create({
          friendlyName: taskQueueName,
          reservationActivitySid: workSpace?.defaultActivitySid || '',
          assignmentActivitySid: workSpace?.defaultActivitySid || '',
        });
              log.green({
          label: 'createTaskRouter',
          message: 'New Task Queue created',
          data: taskQueue?.sid,
        });
    }

    // Step 3: Check if a Workflow with the same name already exists
    const workflowName = \`\${serviceName} Workflow\`;
    let workflow: WorkflowInstance | null = null;
    const workflows = await client.taskrouter.v1
      .workspaces(workSpace?.sid || '')
      .workflows.list();

    if (workflows.length > 0) {
      // If a workflow exists with the exact name, use it
      workflow = workflows.find((wf: any) => wf.friendlyName === workflowName)!;
      if (workflow) {
        log.info({
          label: 'createTaskRouter',
          message: 'Existing Workflow found',
          data: workflow.sid,
        });
        // Update the existing workflow to support simple worker targeting (demo mode)
        workflow = await client.taskrouter.v1
          .workspaces(workSpace?.sid || '')
          .workflows(workflow?.sid || '')
          .update({
            configuration: JSON.stringify({
              task_routing: {
                filters: [
                  {
                    // Route to specific worker when targetWorker is specified, with failover
                    filter_friendly_name:
                      'Specific Worker Filter with Failover',
                    expression: 'targetWorker != null',
                    targets: [
                      {
                        // First target: Try to route to the specific worker with priority
                        queue: taskQueue?.sid || '',
                        expression: \`worker.friendly_name == task.targetWorker\`,
                        timeout: 1, // Wait 1 second for the specific worker
                      },
                      {
                        // Second target: Failover to any available worker
                        queue: taskQueue?.sid || '',
                        // No expression means any available worker in the queue
                      },
                    ],
                  },
                ],
                default_filter: {
                  queue: taskQueue?.sid || '', // Route to any available agent when no targetWorker specified
                },
              },
            }),
          });
        log.green({
          label: 'createTaskRouter',
          message: 'Updated existing Workflow with failover',
          data: workflow?.sid,
        });
      }
    }
    if (!workflow) {
      // If no workflow with the name exists, create a new one
      workflow = await client.taskrouter.v1
        .workspaces(workSpace?.sid || '')
        .workflows.create({
          friendlyName: workflowName,
          configuration: JSON.stringify({
            task_routing: {
              filters: [
                {
                  // Route to specific worker when targetWorker is specified, with failover
                  filter_friendly_name: 'Specific Worker Filter with Failover',
                  expression: 'targetWorker != null',
                  targets: [
                                          {
                        // First target: Try to route to the specific worker with priority
                        queue: taskQueue?.sid || '',
                        expression: \`worker.friendly_name == task.targetWorker\`,
                        timeout: 1, // Wait 1 second for the specific worker
                      },
                      {
                        // Second target: Failover to any available worker
                        queue: taskQueue?.sid || '',
                        // No expression means any available worker in the queue
                      },
                    ],
                  },
                ],
                default_filter: {
                  queue: taskQueue?.sid || '', // Route to any available agent when no targetWorker specified
                },
            },
          }),
        });
              log.green({
          label: 'createTaskRouter',
          message: 'New Workflow created with failover',
          data: workflow?.sid,
        });
    }

    // Save Workflow SID to .env
    if (workflow?.sid) {
      await updateEnvFile('TWILIO_WORKFLOW_SID', workflow.sid);
    }

    return { workspace: workSpace, taskQueue, workflow };
  } catch (error) {
    log.error({
      label: 'createTaskRouter',
      message: 'Error creating TaskRouter service',
      data: error,
    });
    throw error;
  }
}
`;

  await fs.writeFile(path.join(servicesDir, 'createTaskRouter.ts'), createTaskRouterTemplate);

  // Generate helper files
  const updateEnvFileTemplate = `import fs from 'fs-extra';
import path from 'path';

export async function updateEnvFile(key: string, value: string): Promise<void> {
  const envPath = path.join(process.cwd(), '.env');
  
  try {
    // Read existing .env file
    let envContent = '';
    if (await fs.pathExists(envPath)) {
      envContent = await fs.readFile(envPath, 'utf-8');
    }

    // Split content into lines
    const lines = envContent.split('\\n');
    
    // Check if key already exists
    const keyIndex = lines.findIndex(line => line.startsWith(\`\${key}=\`));
    
    if (keyIndex !== -1) {
      // Update existing key
      lines[keyIndex] = \`\${key}=\${value}\`;
    } else {
      // Add new key
      lines.push(\`\${key}=\${value}\`);
    }
    
    // Write back to file
    await fs.writeFile(envPath, lines.join('\\n'));
  } catch (error) {
    console.error('Error updating .env file:', error);
    throw error;
  }
}
`;

  await fs.writeFile(path.join(helpersDir, 'updateEnvFile.ts'), updateEnvFileTemplate);

  const kebabTemplate = `export function kebab(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
`;

  await fs.writeFile(path.join(helpersDir, 'kebab.ts'), kebabTemplate);
}

module.exports = { generateScriptsStructure };
