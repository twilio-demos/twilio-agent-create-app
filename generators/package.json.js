const fs = require('fs-extra');
const path = require('path');

async function generatePackageJson(projectPath, config) {
  const packageJson = {
    name: config.projectName,
    version: "1.0.0",
    description: "A Twilio ConversationRelay agent created with create-twilio-agent",
    main: "dist/app.js",
    scripts: {
      start: "node dist/app.js",
      dev: "NODE_ENV=development ts-node src/app.ts",
      build: "tsc",
      test: "echo \"Error: no test specified\" && exit 1",
      "ngrok:install": "npm install -g ngrok",
      "twilio:init": "ts-node scripts/twilioInit/index.ts"
    },
    dependencies: {
      "twilio": "^5.6.0",
      "@twilio/runtime-handler": "^2.1.0",
      "express": "^4.18.2",
      "express-ws": "^5.0.2",
      "ws": "^8.18.2",
      "fs-extra": "^11.1.1",
      "dotenv": "^16.3.1",
      "axios": "^1.5.0",
      "openai": "^4.20.0",
      "cors": "^2.8.5",
      "helmet": "^7.1.0",
      "morgan": "^1.10.0",
      "compression": "^1.7.4",
      "winston": "^3.10.0",
      "@sendgrid/mail": "^8.1.0",
      "airtable": "^0.12.2"
    },
    devDependencies: {
      "@types/node": "^20.5.0",
      "@types/express": "^4.17.17",
      "@types/express-ws": "^3.0.1",
      "@types/ws": "^8.5.7",
      "@types/fs-extra": "^11.0.2",
      "@types/cors": "^2.8.14",
      "@types/morgan": "^1.9.5",
      "@types/compression": "^1.7.3",
      "typescript": "^5.1.6",
      "ts-node": "^10.9.1"
    },
    keywords: ["twilio", "agent", "ai", "conversationrelay"],
    author: "",
    license: "MIT"
  };

  await fs.writeJson(path.join(projectPath, 'package.json'), packageJson, { spaces: 2 });
}

module.exports = { generatePackageJson }; 