const fs = require('fs-extra');
const path = require('path');

async function generateEnvTemplate(projectPath) {
  const envTemplate = `#---------------DEV REQUIRED FIELDS---------------: 
# description: The Account SID for your Twilio account
# format: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# required: true
TWILIO_ACCOUNT_SID=

# description: The Account Auth Token for your Twilio account
# format: hashed_value
# required: true
TWILIO_AUTH_TOKEN=

# description: The api key used in open ai for accessing chatGPT
# format: hashed_value
# required: true
OPENAI_API_KEY=

# description: The ngrok domain to use for the Express app and Twilio serverless functions (via proxy)
# format: domain.app
# required: true
NGROK_URL=


#---------------OPEN AI---------------:
# description: The model to use for OpenAI API calls
# format: gpt-4.1 | gpt-4o | gpt-4 | gpt-3.5-turbo
# required: false (defaults to gpt-4.1)
OPENAI_MODEL=gpt-4.1


#---------------PORTS & URLS---------------:
# description: The environment node is running in
# format: development | production
# required: true
NODE_ENV=development

# description: The port the conversation relay will be hosted on in local development
# format: 3000
# required: false
PORT=3000

# description: The api key used in sending payloads to a 3rd party webhook
# format: https://domain.com
# required: false
WEBHOOK_URL=

# description: The domain for which the express app is hosted on
# format: subdomain.herokuapp.com - no https or wss - its added where needed.
# required: true
LIVE_HOST_URL=


#---------------TWILIO---------------: 
# description: The Twilio SID used for orchestrating the initial Flex logic
# format: WWxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# required: false (injected by deploy script or found in Twilio console)
TWILIO_WORKFLOW_SID=

# description: Service Name - used as a postfix for things like the serverless functions location
# format: Example Service Name
# required: true
SERVICE_NAME=MYFIRSTAGENT

# description: The phone number used to connect the person to the conversation relay service and text.
# format: +1xxxxxxxxxxxxxx
# required: true (injected by deploy script or found in Twilio console)
TWILIO_CONVERSATION_NUMBER=

# description: The messaging service to orchestrate RCS
# format: +MGxxxxxxxxxxxxxx
# required: false - (injected by deploy script or found in Twilio console)
TWILIO_MESSAGING_SERVICE_SID=

# description: The RCS template to be used by the service
# format: +HXxxxxxxxxxxxxxx
# required: false - (MUST be provided in instructions explicitly for the sendRCS tool if omitted)
TWILIO_CONTENT_SID=

# description: The service for transcribing, scoring etc a call
# format: +GAxxxxxxxxxxxxxx
# required: false 
TWILIO_CONVERSATIONAL_INTELLIGENCE_SID=


#---------------SEGMENT---------------: 
# description: The write key used in segment for posting tracking events
# format: spaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# required: false
SEGMENT_SPACE=

# description: The api key used in segment for accessing the profile
# format: hashed_value
# required: false
SEGMENT_TOKEN=

# description: The write key used in segment for accessing the profile
# format: hashed_value
# required: false
SEGMENT_WRITE_KEY=


#---------------Sendgrid---------------: 
# description: The api key used in initializing Sendgrid
# format: SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# required: false
SENDGRID_API_KEY=

# description: The base template id used in sending emails
# format: d-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# required: false
SENDGRID_TEMPLATE_ID=

# description: The from domain used in sending emails
# format: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# required: false
SENDGRID_DOMAIN=


#---------------AIRTABLE---------------: 
# description: The api key used in sending /receiving payloads to Airtable
# format: hashed_value
# required: false
AIRTABLE_API_KEY=

# description: The base id used in sending /receiving payloads to the targeted Airtable base
# format: appxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# required: false
AIRTABLE_BASE_ID=

# description: The base name used in sending /receiving payloads to the targeted Airtable base
# format: string
# required: false
AIRTABLE_BASE_NAME=
`;

  await fs.writeFile(path.join(projectPath, '.env.example'), envTemplate);
}

module.exports = { generateEnvTemplate }; 