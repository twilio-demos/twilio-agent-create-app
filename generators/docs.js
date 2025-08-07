const fs = require('fs-extra');
const path = require('path');

async function generateReadme(projectPath, config) {
  const readmeTemplate = `# ${config.projectName}

A Twilio ConversationRelay voice agent created with create-twilio-agent.

## Features

This voice agent includes the following tools:
${config.toolCalls.map(tool => '- ' + tool.replace(/([A-Z])/g, ' $1').toLowerCase()).join('\\n')}

## Architecture

- **TypeScript**: Full TypeScript support with proper types
- **ConversationRelay**: Advanced voice call handling
- **Local Configuration**: No external dependencies like Algolia - uses local files
- **Streaming LLM**: Real-time response streaming with abort controllers
- **Tool System**: Modular tool architecture with individual executors
- **WebSocket Support**: Real-time communication
- **Express Server**: RESTful API endpoints

## Setup

1. **Install dependencies:**
   \`\`\`bash
   ${config.packageManager} install
   \`\`\`

2. **Copy environment template:**
   \`\`\`bash
   cp .env.example .env
   \`\`\`

3. **Edit \`.env\` with your credentials:**
   - Add your Twilio Account SID, Auth Token, and Phone Number
   - Add your OpenAI API Key
   - Configure other service credentials as needed

4. **Customize agent instructions:**
   - Edit \`src/lib/prompts/instructions.md\` for agent behavior
   - Edit \`src/lib/prompts/context.md\` for system context

5. **Build the project:**
   \`\`\`bash
   ${config.packageManager} run build
   \`\`\`

6. **Start the agent:**
   \`\`\`bash
   ${config.packageManager} start
   \`\`\`

## Development

### Local Development with Ngrok

1. **Start the development server:**
   \`\`\`bash
   ${config.packageManager} run dev
   \`\`\`

2. **In a separate terminal, start ngrok:**
   \`\`\`bash
   ngrok http 3000
   \`\`\`

3. **Update your .env file:**
   Add the ngrok URL to your \`.env\` file:
   \`\`\`env
   NGROK_URL=https://your-ngrok-url.ngrok.io
   \`\`\`

4. **Configure Twilio webhooks:**
   Use the ngrok URL in Twilio Console:
   - Voice: \`https://your-ngrok-url.ngrok.io/call\`
   - SMS: \`https://your-ngrok-url.ngrok.io/text\`
   - ConversationRelay: \`wss://your-ngrok-url.ngrok.io/conversation-relay\`

### Available Scripts

- \`${config.packageManager} start\` - Start production server
- \`${config.packageManager} run dev\` - Start development server with hot reload
- \`${config.packageManager} run build\` - Build TypeScript to JavaScript
- \`${config.packageManager} run ngrok:install\` - Install ngrok globally
- \`${config.packageManager} run ngrok:start\` - Start ngrok tunnel
- \`${config.packageManager} run dev:with-ngrok\` - Start both ngrok and dev server
${config.scripts && config.scripts.length > 0 ? `- \`${config.packageManager} run twilio:init\` - Run Twilio setup scripts to configure services` : ''}

## Configuration

### Agent Instructions

Edit \`src/lib/prompts/instructions.md\` to customize your agent's behavior, personality, and capabilities.

### Agent Context

Edit \`src/lib/prompts/context.md\` to provide system-level context about your business, services, or domain-specific information.

### Tools

Tools are located in \`src/tools/\`. Each tool has:
- \`manifest.ts\` - OpenAI function definition
- \`executor.ts\` - Implementation logic

To add custom tools:
1. Create a new directory in \`src/tools/\`
2. Add \`manifest.ts\` and \`executor.ts\`
3. Update \`src/tools/manifest.ts\` and \`src/tools/executors.ts\`

${config.scripts && config.scripts.length > 0 ? `### Twilio Setup Scripts

This project includes Twilio setup scripts in \`scripts/twilioInit/\`:

- **assignPhoneNumber.ts** - Assigns a phone number and configures webhooks
- **createTaskRouter.ts** - Creates TaskRouter workspace, queue, and workflow
- **createMessagingService.ts** - Creates messaging service and attaches phone number
- **createConversationalIntelligence.ts** - Creates conversational intelligence service with custom operators

To run the setup scripts:
\`\`\`bash
${config.packageManager} run twilio:init
\`\`\`

Make sure your \`.env\` file contains:
- \`TWILIO_ACCOUNT_SID\`
- \`TWILIO_AUTH_TOKEN\`
- \`SERVICE_NAME\` (for naming services)
- \`NGROK_URL\` or \`LIVE_HOST_URL\` (for webhook URLs)

` : ''}

## Deployment

This agent can be deployed to any Node.js hosting platform:

- **Heroku**: Use the included \`Procfile\`
- **Railway**: Deploy directly from Git
- **AWS/GCP/Azure**: Use Docker or serverless functions
- **Vercel**: Deploy as serverless functions

Make sure to set all environment variables in your hosting platform.

## License

MIT
`;

  await fs.writeFile(path.join(projectPath, 'README.md'), readmeTemplate);
}

async function generateGitignore(projectPath) {
  const gitignore = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# TypeScript build output
dist/
build/
*.tsbuildinfo

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs
*.log

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# nyc test coverage
.nyc_output

# Dependency directories
jspm_packages/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Temporary folders
tmp/
temp/
`;

  await fs.writeFile(path.join(projectPath, '.gitignore'), gitignore);
}

module.exports = { generateReadme, generateGitignore }; 