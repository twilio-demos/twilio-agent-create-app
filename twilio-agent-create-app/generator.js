const fs = require('fs-extra');
const path = require('path');
const ora = require('ora');
const chalk = require('chalk');

async function generateProject(config) {
  const spinner = ora('Creating your Twilio agent...').start();
  
  try {
    const projectPath = path.resolve(config.projectName);
    
    // Create project directory
    await fs.ensureDir(projectPath);
    
    // Generate package.json with TypeScript setup
    await generatePackageJson(projectPath, config);
    
    // Generate TypeScript configuration
    await generateTsConfig(projectPath);
    
    // Generate Procfile
    await generateProcfile(projectPath);
    
    // Generate main app.ts file
    await generateAppFile(projectPath, config);
    
    // Generate LLM service file
    await generateLlmFile(projectPath, config);
    
    // Generate lib directory structure
    await generateLibStructure(projectPath, config);
    
    // Generate tool files
    await generateTools(projectPath, config);
    
    // Generate routes directory
    await generateRoutes(projectPath, config);
    
    // Generate voices.ts
    await generateVoicesFile(projectPath);
    
    // Generate environment template
    await generateEnvTemplate(projectPath);
    
    // Generate README
    await generateReadme(projectPath, config);
    
    // Generate .gitignore
    await generateGitignore(projectPath);
    
    // Initialize git if requested
    if (config.git) {
      await initializeGit(projectPath);
    }
    
    // Install dependencies
    await installDependencies(projectPath, config);
    
    spinner.succeed(chalk.green('Twilio agent created successfully!'));
    
    console.log('\n' + chalk.cyan('Next steps:'));
    console.log(chalk.white(`  cd ${config.projectName}`));
    console.log(chalk.white('  cp .env.example .env'));
    console.log(chalk.white('  # Edit .env with your Twilio credentials'));
    console.log(chalk.white('  # Edit src/lib/prompts/instructions.md with your agent instructions'));
    console.log(chalk.white(`  ${config.packageManager} run build`));
    console.log(chalk.white(`  ${config.packageManager} start`));
    
  } catch (error) {
    spinner.fail(chalk.red('Failed to create project'));
    throw error;
  }
}

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
      "ngrok:start": "ngrok http 3000",
      "dev:with-ngrok": "npm run ngrok:start & npm run dev"
    },
    dependencies: {
      "twilio": "^4.19.0",
      "express": "^4.18.2",
      "express-ws": "^5.0.2",
      "dotenv": "^16.3.1",
      "axios": "^1.5.0",
      "openai": "^4.20.0",
      "cors": "^2.8.5",
      "helmet": "^7.1.0",
      "morgan": "^1.10.0",
      "compression": "^1.7.4",
      "winston": "^3.10.0"
    },
    devDependencies: {
      "@types/node": "^20.5.0",
      "@types/express": "^4.17.17",
      "@types/express-ws": "^3.0.1",
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

async function generateTsConfig(projectPath) {
  const tsConfig = {
    compilerOptions: {
      target: "ES2020",
      lib: ["ES2020"],
      module: "commonjs",
      outDir: "./dist",
      rootDir: "./src",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      removeComments: false,
      noImplicitAny: true,
      noImplicitReturns: true,
      noImplicitThis: true,
      noUnusedLocals: false,
      noUnusedParameters: false,
      exactOptionalPropertyTypes: false,
      noFallthroughCasesInSwitch: true,
      noUncheckedIndexedAccess: false,
      moduleResolution: "node",
      baseUrl: ".",
      paths: {
        "@/*": ["src/*"]
      }
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist", "**/*.test.ts"]
  };

  await fs.writeJson(path.join(projectPath, 'tsconfig.json'), tsConfig, { spaces: 2 });
}

async function generateProcfile(projectPath) {
  const procfile = 'web: node dist/app.js';
  await fs.writeFile(path.join(projectPath, 'Procfile'), procfile);
}

async function generateAppFile(projectPath, config) {
  const srcDir = path.join(projectPath, 'src');
  await fs.ensureDir(srcDir);
  
  const appTemplate = `import 'dotenv/config';
import express from 'express';
import ExpressWs from 'express-ws';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

// Local imports
import { log } from './lib/utils/logger';
import { setupConversationRelayRoute } from './routes/conversationRelay';
import callRouter from './routes/call';
import smsRouter from './routes/sms';
import liveAgentRouter from './routes/liveAgent';
import outboundCallRouter from './routes/outboundCall';
import statsRouter from './routes/stats';
import activeNumbersRouter from './routes/activeNumbers';
import outboundMessageRouter from './routes/outboundMessage';
import liveNumbersRouter from './routes/liveNumbers';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const { app } = ExpressWs(express());

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));

// Configure CORS based on environment
if (process.env.NODE_ENV !== 'production') {
  // In development, allow localhost:3000 to talk to localhost:3001
  app.use(
    cors({
      origin: 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );
} else {
  // In production, allow your frontend domain
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );
}

app.use(express.urlencoded({ extended: true })).use(express.json());

// Set up WebSocket route for conversation relay
setupConversationRelayRoute(app);

// Set up HTTP routes
app.use('/', callRouter);
app.use('/', smsRouter);
app.use('/', liveAgentRouter);
app.use('/', outboundCallRouter);
app.use('/', statsRouter);
app.use('/', activeNumbersRouter);
app.use('/', outboundMessageRouter);
app.use('/', liveNumbersRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  log.info({
    label: 'server',
    message: \`Server listening on port \${PORT}\`,
  });
});
`;

  await fs.writeFile(path.join(srcDir, 'app.ts'), appTemplate);
}

async function generateLlmFile(projectPath, config) {
  const srcDir = path.join(projectPath, 'src');
  
  const llmTemplate = `import 'dotenv/config';
import OpenAI from 'openai';

// Local imports
import {
  LLMEvents,
  Store,
  TypedEventEmitter,
  LocalTemplateData,
} from './lib/types';
import { log } from './lib/utils/logger';
import { sendToWebhook } from './lib/utils/webhook';
import { tools } from './tools/manifest';
import { executeTool } from './tools/executors';
import { getLocalTemplateData } from './lib/utils/llm/getTemplateData';

// ========================================
// LLM Configuration
// ========================================

export class LLMService {
  private openai: OpenAI;
  private model: string;
  private store: Store = { context: {}, msgs: [] };
  private emitter = new TypedEventEmitter<LLMEvents>();
  private customerNumber: string;
  private templateData: LocalTemplateData | null = null;
  private currentRequest: AbortController | null = null;
  private currentResponseId: string = '';
  private _isVoiceCall: boolean = false;

  constructor(
    customerNumber: string,
    templateData: LocalTemplateData | null
  ) {
    this.customerNumber = customerNumber;
    this.templateData = templateData;
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.model = process.env.OPENAI_MODEL || 'gpt-4o';
  }

  public async notifyInitialCallParams() {
    await sendToWebhook(
      {
        sender: 'begin',
        type: 'string',
        message: this.customerNumber,
        phoneNumber: this.customerNumber,
      },
      this.templateData?.webhookUrl
    ).catch((err: Error) => console.error('Failed to send to webhook:', err));
    
    this.addMessage({
      role: 'system',
      content: \`The customer's phone number is \${this.customerNumber}.\`,
    });

    // Add instructions from local file
    if (this.templateData?.instructions) {
      this.addMessage({
        role: 'system',
        content: this.templateData.instructions,
      });
    }

    // Add context from local file
    if (this.templateData?.context) {
      this.addMessage({
        role: 'system',
        content: this.templateData.context,
      });
    }
  }

  // Event emitter methods
  on: (typeof this.emitter)['on'] = (...args) => this.emitter.on(...args);
  emit: (typeof this.emitter)['emit'] = (...args) => this.emitter.emit(...args);
  removeAllListeners: (typeof this.emitter)['removeAllListeners'] = (...args) =>
    this.emitter.removeAllListeners(...args);

  // Voice call state management
  get isVoiceCall(): boolean {
    return this._isVoiceCall;
  }

  set isVoiceCall(value: boolean) {
    this._isVoiceCall = value;
  }

  // Add message to conversation history
  addMessage = (msg: {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }) => {
    this.store.msgs.push(msg);

    // Kill switch: if message queue exceeds 300, end the call
    if (this.store.msgs.length > 300) {
      log.error({
        label: 'llm',
        phone: this.customerNumber,
        message: \`Message queue exceeded 300 messages (\${this.store.msgs.length}). Ending call for safety.\`,
      });
      this.emit('handoff', {
        reasonCode: 'message_limit_exceeded',
        reason: 'Conversation exceeded maximum message limit for safety',
        messageCount: this.store.msgs.length,
      });
      return this;
    }
    return this;
  };

  // Process conversation and get response
  run = async (isUserPrompt: boolean = true) => {
    // Only cancel existing request if this is a user prompt (not a continuation)
    if (this.currentRequest && isUserPrompt) {
      this.currentRequest.abort();
      log.info({
        label: 'llm',
        phone: this.customerNumber,
        message: 'Cancelled previous request due to new prompt',
      });
    }

    // Create new abort controller for this request
    this.currentRequest = new AbortController();

    // Generate a new response ID for this response
    const responseId =
      Date.now().toString() + Math.random().toString(36).substr(2, 9);
    this.currentResponseId = responseId;

    try {
      const stream = await this.openai.chat.completions.create(
        {
          model: this.model,
          messages: this.store.msgs,
          stream: true,
          temperature: 0.1,
          tools: Object.entries(tools).map(([_key, tool]) => {
            return tool.manifest;
          }),
        },
        this.currentRequest ? { signal: this.currentRequest.signal } : undefined
      );

      let fullText = '';
      let currentChunk = '';
      let toolCallInProgress = false;
      let toolCallBuffer = '';
      let currentToolName = '';
      let streamBuffer = '';
      let lastEmitTime = Date.now();

      for await (const chunk of stream) {
        // Check if this request was cancelled
        if (this.currentRequest && this.currentRequest.signal.aborted) {
          log.info({
            label: 'llm',
            phone: this.customerNumber,
            message: 'Request was cancelled, stopping processing',
          });
          return;
        }

        const content = chunk.choices[0]?.delta?.content || '';
        const toolCalls = chunk.choices[0]?.delta?.tool_calls;

        if (toolCalls) {
          toolCallInProgress = true;

          // Buffer tool call data
          if (toolCalls[0]?.function?.name) {
            currentToolName = toolCalls[0].function.name;
          }
          if (toolCalls[0]?.function?.arguments) {
            toolCallBuffer += toolCalls[0].function.arguments;
          }

          // Try to parse the buffered arguments
          try {
            const args = JSON.parse(toolCallBuffer);
            
            // Log tool call
            log.tool_call({
              phone: this.customerNumber,
              message: currentToolName,
              data: {
                toolName: currentToolName,
                args: JSON.parse(toolCallBuffer),
              },
            });

            // Send tool execution to webhook
            await sendToWebhook(
              {
                sender: 'system:tool',
                type: 'string',
                message: \`Executing \${currentToolName} with args: \${toolCallBuffer}\`,
                phoneNumber: this.customerNumber,
              },
              this.templateData?.webhookUrl
            ).catch((err) =>
              log.error({
                label: 'webhook',
                phone: this.customerNumber,
                message: 'Failed to send tool execution',
                data: err,
              })
            );

            const result = await executeTool({
              currentToolName,
              args,
              toolData: this.templateData?.toolData || {},
              webhookUrl: this.templateData?.webhookUrl,
            });
            
            // Log tool result
            log.tool_result({
              phone: this.customerNumber,
              message: \`\${currentToolName} - \${
                result.success ? 'success' : 'failed'
              }\`,
              data: {
                toolName: currentToolName,
                success: result.success,
                result: result.success ? result.data : result.error,
              },
            });

            // Send tool result to webhook
            await sendToWebhook(
              {
                sender: 'system:tool',
                type: 'string',
                message: result.success
                  ? \`Tool \${currentToolName} succeeded: \${JSON.stringify(
                      result.data
                    )}\`
                  : \`Tool \${currentToolName} failed: \${result.error}\`,
                phoneNumber: this.customerNumber,
              },
              this.templateData?.webhookUrl
            ).catch((err) =>
              log.error({
                label: 'webhook',
                phone: this.customerNumber,
                message: 'Failed to send tool result',
                data: err,
              })
            );

            if (result.success) {
              this.addMessage({
                role: 'system',
                content: \`Tool call \${currentToolName} succeeded with data: \${JSON.stringify(
                  result.data
                )}\`,
              });

              // Handle live agent handoff
              if (currentToolName === 'sendToLiveAgent') {
                this.emit('handoff', result.data);
                this.currentRequest = null;
                return;
              }

              // Handle language switching
              if (currentToolName === 'switchLanguage') {
                this.emit('language', result.data);
              }
            } else {
              this.addMessage({
                role: 'system',
                content: \`Tool call \${currentToolName} failed: \${result.error}\`,
              });
            }

            // Reset buffers after execution
            toolCallBuffer = '';
            currentToolName = '';
            toolCallInProgress = false;

            // Add a prompt to continue the conversation
            this.addMessage({
              role: 'system',
              content:
                'Please continue the conversation based on the gathered information.',
            });
          } catch (e) {
            // JSON parsing failed - continue buffering
            continue;
          }
        }

        if (content) {
          currentChunk += content;
          fullText += content;
          streamBuffer += content;

          // Stream buffering for latency optimization
          const now = Date.now();
          const shouldEmit = 
            streamBuffer.length >= 20 || // Emit every 20 characters
            content.includes('.') || 
            content.includes('?') || 
            content.includes('!') ||
            (now - lastEmitTime) > 1000; // Or every second

          if (shouldEmit && this.currentResponseId === responseId) {
            this.emit('text', streamBuffer, false);
            streamBuffer = '';
            lastEmitTime = now;
          }
        }
      }

      // Send any remaining buffered text
      if (streamBuffer && this.currentResponseId === responseId) {
        this.emit('text', streamBuffer, false);
      }

      // Send final chunk and full text
      if (fullText.length > 1 && this.currentResponseId === responseId) {
        this.emit('text', '', true, fullText);
      } else if (this.currentResponseId === responseId) {
        this.run(false); // Continue conversation (not a user prompt)
      }

      // Add assistant's response to conversation history
      if (fullText || toolCallInProgress) {
        this.addMessage({
          role: 'assistant',
          content: fullText,
        });
      }

      // Clear the current request since it's complete
      this.currentRequest = null;
    } catch (error: any) {
      // Check if this was an abort error
      if (
        error.name === 'AbortError' ||
        error.code === 'ABORT_ERR' ||
        error.message?.includes('aborted') ||
        error.message?.includes('cancelled') ||
        (this.currentRequest && this.currentRequest.signal.aborted)
      ) {
        log.info({
          label: 'llm',
          phone: this.customerNumber,
          message: 'Request was aborted/cancelled',
        });
        this.currentRequest = null;
        return;
      }

      // Only log and handle as conversation error if it's not an abort
      log.error({
        label: 'llm',
        phone: this.customerNumber,
        message: 'Conversation error',
        data: {
          error: error.message || error.toString(),
          name: error.name,
          code: error.code,
        },
      });

      // Add error message to conversation history
      this.addMessage({
        role: 'assistant',
        content:
          'I apologize, but I encountered an error. Could you please try again?',
      });

      // Clear the current request on error
      this.currentRequest = null;
    }
  };
}
`;

  await fs.writeFile(path.join(srcDir, 'llm.ts'), llmTemplate);
}

async function generateVoicesFile(projectPath) {
  const srcDir = path.join(projectPath, 'src');
  
  const voicesTemplate = `export const voices = {
  'en-US': 'nova',
  'es-ES': 'nova',
  'fr-FR': 'nova',
  'de-DE': 'nova',
  'it-IT': 'nova',
  'pt-BR': 'nova',
  'ja-JP': 'nova',
  'ko-KR': 'nova',
  'zh-CN': 'nova',
  default: 'nova'
};

export type Voice = typeof voices[keyof typeof voices];
export type Language = keyof typeof voices;
`;

  await fs.writeFile(path.join(srcDir, 'voices.ts'), voicesTemplate);
}

async function generateLibStructure(projectPath, config) {
  const libDir = path.join(projectPath, 'src', 'lib');
  await fs.ensureDir(libDir);
  
  // Create lib subdirectories
  await fs.ensureDir(path.join(libDir, 'utils'));
  await fs.ensureDir(path.join(libDir, 'utils', 'llm'));
  await fs.ensureDir(path.join(libDir, 'types'));
  await fs.ensureDir(path.join(libDir, 'config'));
  await fs.ensureDir(path.join(libDir, 'prompts'));
  
  // Generate logger
  const loggerTemplate = `import winston from 'winston';

const NS_PAD = 32;

const CC = {
  invert: '\\x1b[7m',
  clear: '\\x1b[0m',
  red: '\\x1b[31m',
  yellow: '\\x1b[33m',
  cyan: '\\x1b[36m',
  brightCyan: '\\x1b[96m',
  green: '\\x1b[32m',
  magenta: '\\x1b[35m',
  teal: '\\x1b[38;5;30m',
  lightPurple: '\\x1b[38;5;141m',
  pink: '\\x1b[38;5;219m',
  orange: '\\x1b[38;5;208m',
  lightBlue: '\\x1b[38;5;75m',
};

const title = (label?: string, color = CC.clear, phoneNumber?: string) => {
  const phonePrefix = phoneNumber ? \`[\${phoneNumber}] \` : '';
  const safeLabel = label || 'unknown';
  return color + phonePrefix + safeLabel.padEnd(NS_PAD) + CC.clear;
};

const stringify = (arg: any): string => {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return arg.message;
  try {
    const cache = new WeakSet();
    return JSON.stringify(arg, (k, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) return '[Circular]';
        cache.add(value);
      }
      return value;
    }, 2);
  } catch (err) {
    try {
      const util = require('util');
      return util.inspect(arg, { depth: 2, colors: false });
    } catch {
      return String(arg);
    }
  }
};

interface LogData {
  label?: string;
  phone?: string;
  message?: string;
  data?: any;
  [key: string]: any;
}

export const log = {
  info: (data: LogData) => {
    const { label, phone, message, ...rest } = data;
    console.log(title(label, CC.cyan, phone), message, ...Object.values(rest));
  },
  error: (data: LogData) => {
    const { label, phone, message, ...rest } = data;
    console.error(title(label, CC.red, phone), message, ...Object.values(rest));
  },
  warn: (data: LogData) => {
    const { label, phone, message, ...rest } = data;
    console.warn(title(label, CC.yellow, phone), message, ...Object.values(rest));
  },
  success: (data: LogData) => {
    const { label, phone, message, ...rest } = data;
    console.log(title(label, CC.green, phone), message, ...Object.values(rest));
  },
  cyan: (data: LogData) => {
    const { label, phone, message, ...rest } = data;
    console.log(title(label, CC.cyan, phone), message, ...Object.values(rest));
  },
  green: (data: LogData) => {
    const { label, phone, message, ...rest } = data;
    console.log(title(label, CC.green, phone), message, ...Object.values(rest));
  },
  yellow: (data: LogData) => {
    const { label, phone, message, ...rest } = data;
    console.log(title(label, CC.yellow, phone), message, ...Object.values(rest));
  },
  magenta: (data: LogData) => {
    const { label, phone, message, ...rest } = data;
    console.log(title(label, CC.magenta, phone), message, ...Object.values(rest));
  },
  sms_received: (data: LogData) => {
    const { phone, message, ...rest } = data;
    console.log(title('sms_received', CC.green, phone), message, ...Object.values(rest));
  },
  sms_sent: (data: LogData) => {
    const { phone, message, ...rest } = data;
    console.log(title('sms_sent', CC.cyan, phone), message, ...Object.values(rest));
  },
  tool_call: (data: LogData) => {
    const { phone, message, ...rest } = data;
    console.log(title('tool_call', CC.orange, phone), message, ...Object.values(rest));
  },
  tool_result: (data: LogData) => {
    const { phone, message, ...rest } = data;
    console.log(title('tool_result', CC.lightBlue, phone), message, ...Object.values(rest));
  }
};
`;

  await fs.writeFile(path.join(libDir, 'utils', 'logger.ts'), loggerTemplate);
  
  // Generate webhook utility
  const webhookTemplate = `import axios from 'axios';
import { log } from './logger';

export interface WebhookMessage {
  sender: string;
  type: string;
  message: string;
  phoneNumber: string;
}

export async function sendToWebhook(
  message: WebhookMessage,
  webhookUrl?: string
): Promise<void> {
  if (!webhookUrl) {
    log.warn({
      label: 'webhook',
      message: 'No webhook URL provided, skipping webhook send',
    });
    return;
  }

  try {
    await axios.post(webhookUrl, message, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });
    
    log.info({
      label: 'webhook',
      message: 'Successfully sent to webhook',
      data: { sender: message.sender, type: message.type },
    });
  } catch (error: any) {
    log.error({
      label: 'webhook',
      message: 'Failed to send to webhook',
      data: {
        error: error.message,
        url: webhookUrl,
        sender: message.sender,
      },
    });
    throw error;
  }
}
`;

  await fs.writeFile(path.join(libDir, 'utils', 'webhook.ts'), webhookTemplate);
  
  // Generate getTemplateData utility
  const getTemplateDataTemplate = `import fs from 'fs-extra';
import path from 'path';
import { LocalTemplateData } from '../../types';

export async function getLocalTemplateData(): Promise<LocalTemplateData> {
  const rootDir = path.resolve(__dirname, '../../../');
  
  let instructions = '';
  let context = '';
  
  try {
    const instructionsPath = path.join(rootDir, 'src/lib/prompts/instructions.md');
    if (await fs.pathExists(instructionsPath)) {
      instructions = await fs.readFile(instructionsPath, 'utf-8');
    }
  } catch (error) {
    console.warn('Could not read instructions.md:', error);
  }
  
  try {
    const contextPath = path.join(rootDir, 'src/lib/prompts/context.md');
    if (await fs.pathExists(contextPath)) {
      context = await fs.readFile(contextPath, 'utf-8');
    }
  } catch (error) {
    console.warn('Could not read context.md:', error);
  }
  
  return {
    instructions,
    context,
    webhookUrl: process.env.WEBHOOK_URL,
    toolData: {
      // Tool-specific environment variables
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
      twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
      segmentWriteKey: process.env.SEGMENT_WRITE_KEY,
      segmentWorkspace: process.env.SEGMENT_WORKSPACE,
      airtableApiKey: process.env.AIRTABLE_API_KEY,
      airtableBaseId: process.env.AIRTABLE_BASE_ID,
      emailApiKey: process.env.EMAIL_API_KEY,
      emailFromAddress: process.env.EMAIL_FROM_ADDRESS,
    },
  };
}
`;

  await fs.writeFile(path.join(libDir, 'utils', 'llm', 'getTemplateData.ts'), getTemplateDataTemplate);
  
  // Generate types
  const typesTemplate = `import { EventEmitter } from 'events';

export interface Store {
  context: Record<string, any>;
  msgs: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
}

export interface LLMEvents {
  text: (chunk: string, isFinal: boolean, fullText?: string) => void;
  handoff: (data: any) => void;
  language: (data: any) => void;
}

export class TypedEventEmitter<T> extends EventEmitter {
  on<K extends keyof T>(event: K, listener: T[K]): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): boolean;
  emit(event: string | symbol, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }
}

export interface LocalTemplateData {
  instructions: string;
  context: string;
  webhookUrl?: string;
  toolData: {
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    twilioPhoneNumber?: string;
    segmentWriteKey?: string;
    segmentWorkspace?: string;
    airtableApiKey?: string;
    airtableBaseId?: string;
    emailApiKey?: string;
    emailFromAddress?: string;
    [key: string]: any;
  };
}

export interface ToolManifest {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface ToolExecutorParams {
  currentToolName: string;
  args: any;
  toolData: LocalTemplateData['toolData'];
  webhookUrl?: string;
}
`;

  await fs.writeFile(path.join(libDir, 'types', 'index.ts'), typesTemplate);
  
  // Generate languages config
  const languagesTemplate = `export const languages = {
  'en-US': 'English',
  'es-ES': 'Spanish',
  'fr-FR': 'French',
  'de-DE': 'German',
  'it-IT': 'Italian',
  'pt-BR': 'Portuguese',
  'ja-JP': 'Japanese',
  'ko-KR': 'Korean',
  'zh-CN': 'Chinese',
} as const;

export type LanguageCode = keyof typeof languages;
export type LanguageName = typeof languages[LanguageCode];
`;

  await fs.writeFile(path.join(libDir, 'config', 'languages.ts'), languagesTemplate);
  
  // Generate instructions.md
  const instructionsTemplate = `# Agent Instructions

You are a helpful voice agent for Twilio ConversationRelay. Your role is to assist customers with their inquiries in a professional and efficient manner.

## Key Guidelines

1. **Be conversational**: Since this is a voice interaction, speak naturally and keep responses concise
2. **Be helpful**: Always try to assist the customer with their needs
3. **Use tools**: You have access to various tools to provide better service - use them when appropriate
4. **Stay professional**: Maintain a friendly but professional tone
5. **Transfer when needed**: If you cannot help, transfer to a live agent using the sendToLiveAgent tool

## Available Capabilities

- Look up customer information
- Send follow-up text messages
- Make outbound calls
- Transfer to live agents
- Switch languages if requested
- And more depending on configured tools

## Example Interactions

**Customer**: "I need help with my account"
**You**: "I'd be happy to help you with your account. Let me look up your information first."

**Customer**: "Can you send me a text with the details?"
**You**: "Of course! I'll send you a text message with all the details right now."

Remember to always be helpful and use the tools available to provide the best possible service.
`;

  await fs.writeFile(path.join(libDir, 'prompts', 'instructions.md'), instructionsTemplate);
  
  // Generate context.md
  const contextTemplate = `# Agent Context

This agent is powered by Twilio ConversationRelay and is designed to handle voice calls efficiently.

## System Information

- Built with TypeScript and Express
- Uses OpenAI for natural language processing
- Integrates with Twilio services
- Supports real-time voice conversations

## Important Notes

- All conversations are logged for quality assurance
- Customer phone numbers are automatically captured
- Tools are executed in real-time during conversations
- Conversations have a safety limit of 300 messages

## Environment

- Node.js runtime
- Express web server
- WebSocket connections for real-time communication
- RESTful API endpoints for various functions
`;

  await fs.writeFile(path.join(libDir, 'prompts', 'context.md'), contextTemplate);
}

async function generateTools(projectPath, config) {
  const toolsDir = path.join(projectPath, 'src', 'tools');
  await fs.ensureDir(toolsDir);
  
  // Generate tool manifest
  const manifestTemplate = `${config.toolCalls.map(tool => `import { ${tool}Manifest } from './${tool}/manifest';`).join('\n')}
import { ToolManifest } from '../lib/types';

export const tools: Record<string, { manifest: ToolManifest }> = {
${config.toolCalls.map(tool => `  ${tool}: {
    manifest: ${tool}Manifest,
  },`).join('\n')}
};
`;

  await fs.writeFile(path.join(toolsDir, 'manifest.ts'), manifestTemplate);
  
  // Generate tool executors
  const executorsTemplate = `${config.toolCalls.map(tool => `import { execute as ${tool}Execute } from './${tool}/executor';`).join('\n')}
import { ToolExecutorParams, ToolResult } from '../lib/types';

export async function executeTool(params: ToolExecutorParams): Promise<ToolResult> {
  const { currentToolName, args, toolData, webhookUrl } = params;
  
  try {
    switch (currentToolName) {
${config.toolCalls.map(tool => `      case '${tool}':
        return await ${tool}Execute(args, toolData);`).join('\n')}
      default:
        return {
          success: false,
          error: \`Unknown tool: \${currentToolName}\`,
        };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Tool execution failed',
    };
  }
}
`;

  await fs.writeFile(path.join(toolsDir, 'executors.ts'), executorsTemplate);
  
  // Generate individual tool files
  const toolDefinitions = {
    sendText: {
      manifest: `import { ToolManifest } from '../../lib/types';

export const sendTextManifest: ToolManifest = {
  type: 'function',
  function: {
    name: 'sendText',
    description: 'Send SMS text message',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Phone number to send to'
        },
        message: {
          type: 'string',
          description: 'Message content'
        }
      },
      required: ['to', 'message']
    }
  }
};`,
      executor: `import { Twilio } from 'twilio';
import { ToolResult, LocalTemplateData } from '../../lib/types';

export async function execute(
  args: { to: string; message: string },
  toolData: LocalTemplateData['toolData']
): Promise<ToolResult> {
  const { to, message } = args;
  
  try {
    const client = new Twilio(
      toolData.twilioAccountSid,
      toolData.twilioAuthToken
    );
    
    const result = await client.messages.create({
      body: message,
      to: to,
      from: toolData.twilioPhoneNumber
    });
    
    return {
      success: true,
      data: {
        messageId: result.sid,
        status: result.status
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}`
    },
    
    sendRCS: {
      manifest: `import { ToolManifest } from '../../lib/types';

export const sendRCSManifest: ToolManifest = {
  type: 'function',
  function: {
    name: 'sendRCS',
    description: 'Send RCS message',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Phone number to send to'
        },
        message: {
          type: 'string',
          description: 'Message content'
        }
      },
      required: ['to', 'message']
    }
  }
};`,
      executor: `import { ToolResult, LocalTemplateData } from '../../lib/types';

export async function execute(
  args: { to: string; message: string },
  toolData: LocalTemplateData['toolData']
): Promise<ToolResult> {
  const { to, message } = args;
  
  // Placeholder implementation for RCS
  console.log('Sending RCS message:', { to, message });
  
  return {
    success: true,
    data: {
      messageId: 'rcs-placeholder-id',
      to,
      message
    }
  };
}`
    },
    
    sendToLiveAgent: {
      manifest: `import { ToolManifest } from '../../lib/types';

export const sendToLiveAgentManifest: ToolManifest = {
  type: 'function',
  function: {
    name: 'sendToLiveAgent',
    description: 'Transfer conversation to live agent',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Reason for handoff'
        },
        priority: {
          type: 'string',
          description: 'Priority level',
          enum: ['low', 'medium', 'high', 'urgent']
        }
      },
      required: ['reason']
    }
  }
};`,
      executor: `import { ToolResult, LocalTemplateData } from '../../lib/types';

export async function execute(
  args: { reason: string; priority?: string },
  toolData: LocalTemplateData['toolData']
): Promise<ToolResult> {
  const { reason, priority = 'medium' } = args;
  
  console.log('Handing off to live agent:', { reason, priority });
  
  return {
    success: true,
    data: {
      handoffId: 'handoff-' + Date.now(),
      reason: reason,
      priority: priority,
      reasonCode: 'live_agent_request'
    }
  };
}`
    },
    
    switchLanguage: {
      manifest: `import { ToolManifest } from '../../lib/types';

export const switchLanguageManifest: ToolManifest = {
  type: 'function',
  function: {
    name: 'switchLanguage',
    description: 'Switch conversation language',
    parameters: {
      type: 'object',
      properties: {
        language: {
          type: 'string',
          description: 'Target language code',
          enum: ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN']
        }
      },
      required: ['language']
    }
  }
};`,
      executor: `import { ToolResult, LocalTemplateData } from '../../lib/types';

export async function execute(
  args: { language: string },
  toolData: LocalTemplateData['toolData']
): Promise<ToolResult> {
  const { language } = args;
  
  return {
    success: true,
    data: {
      language: language,
      message: \`Switched to \${language}\`
    }
  };
}`
    },
    
    getSegmentProfile: {
      manifest: `import { ToolManifest } from '../../lib/types';

export const getSegmentProfileManifest: ToolManifest = {
  type: 'function',
  function: {
    name: 'getSegmentProfile',
    description: 'Get Segment user profile',
    parameters: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to look up'
        }
      },
      required: ['userId']
    }
  }
};`,
      executor: `import { ToolResult, LocalTemplateData } from '../../lib/types';

export async function execute(
  args: { userId: string },
  toolData: LocalTemplateData['toolData']
): Promise<ToolResult> {
  const { userId } = args;
  
  // Placeholder implementation
  console.log('Getting Segment profile for:', userId);
  
  return {
    success: true,
    data: {
      userId: userId,
      traits: {
        email: 'user@example.com',
        name: 'John Doe',
        phone: '+1234567890'
      }
    }
  };
}`
    }
  };
  
  // Generate selected tools
  for (const toolName of config.toolCalls) {
    if (toolDefinitions[toolName]) {
      const toolDir = path.join(toolsDir, toolName);
      await fs.ensureDir(toolDir);
      
      await fs.writeFile(
        path.join(toolDir, 'manifest.ts'),
        toolDefinitions[toolName].manifest
      );
      
      await fs.writeFile(
        path.join(toolDir, 'executor.ts'),
        toolDefinitions[toolName].executor
      );
    }
  }
  
  // Generate additional tools with basic placeholders if selected
  const additionalTools = ['sendEmail', 'getSegmentEvents', 'updateSegmentProfile', 'postSegmentTrack', 'getAirtableData', 'upsertAirtableData'];
  
  for (const toolName of config.toolCalls) {
    if (additionalTools.includes(toolName) && !toolDefinitions[toolName]) {
      const toolDir = path.join(toolsDir, toolName);
      await fs.ensureDir(toolDir);
      
      const placeholderManifest = `import { ToolManifest } from '../../lib/types';

export const ${toolName}Manifest: ToolManifest = {
  type: 'function',
  function: {
    name: '${toolName}',
    description: '${toolName} tool',
    parameters: {
      type: 'object',
      properties: {
        data: {
          type: 'string',
          description: 'Input data'
        }
      },
      required: ['data']
    }
  }
};`;
      
      const placeholderExecutor = `import { ToolResult, LocalTemplateData } from '../../lib/types';

export async function execute(
  args: any,
  toolData: LocalTemplateData['toolData']
): Promise<ToolResult> {
  console.log('${toolName} executed with args:', args);
  
  return {
    success: true,
    data: {
      message: '${toolName} executed successfully',
      args
    }
  };
}`;
      
      await fs.writeFile(path.join(toolDir, 'manifest.ts'), placeholderManifest);
      await fs.writeFile(path.join(toolDir, 'executor.ts'), placeholderExecutor);
    }
  }
}

async function generateRoutes(projectPath, config) {
  const routesDir = path.join(projectPath, 'src', 'routes');
  await fs.ensureDir(routesDir);
  
  // Generate routeNames.ts
  const routeNamesTemplate = `export const routeNames = {
  call: 'call',
  conversationRelay: 'conversation-relay',
  liveAgent: 'live-agent',
  sms: 'text',
  outboundCall: 'outbound-call',
  stats: 'stats',
  activeNumbers: 'active-numbers',
  outboundMessage: 'outbound-message',
  liveNumbers: 'live-numbers',
} as const;

export type RouteNames = typeof routeNames[keyof typeof routeNames];
`;

  await fs.writeFile(path.join(routesDir, 'routeNames.ts'), routeNamesTemplate);

  // Generate call.ts
  const callRouteTemplate = `import { Router } from 'express';
import { Twilio } from 'twilio';

const router = Router();

router.get('/call', async (req, res) => {
  const env = process.env.NODE_ENV;
  const isProduction = env === 'production';

  const {
    From: fromNumber,
    To: toNumber,
    Direction: direction,
  } = req.query as { From?: string; To?: string; Direction?: string };

  // For outbound calls, use the "To" number as the caller number
  let callerNumber: string;
  if (direction && direction.includes('outbound')) {
    callerNumber = toNumber || '';
    console.log('Outbound call detected. Using "To" number as caller: ' + callerNumber);
  } else {
    callerNumber = fromNumber || '';
    console.log('Inbound call detected. Using "From" number as caller: ' + callerNumber);
  }

  // action endpoint will be executed when action is dispatched to the ConversationRelay websocket
  const baseActionUrl = isProduction
    ? 'https://' + process.env.LIVE_HOST_URL + '/live-agent'
    : 'https://' + (process.env.NGROK_URL || req.get('host')) + '/live-agent';

  const relayUrl = isProduction
    ? 'wss://' + process.env.LIVE_HOST_URL + '/conversation-relay'
    : 'wss://' + (process.env.NGROK_URL || req.get('host')) + '/conversation-relay';

  console.log('🔧 Relay URL:', relayUrl);
  console.log('🔧 NGROK_URL:', process.env.NGROK_URL);
  console.log('🔧 LIVE_HOST_URL:', process.env.LIVE_HOST_URL);

  const twiml = new Twilio.twiml.VoiceResponse();
  
  // Connect to ConversationRelay
  const connect = twiml.connect();
  connect.conversation({
    serviceInstanceSid: process.env.TWILIO_CONVERSATION_SERVICE_SID!,
    participantIdentity: callerNumber,
    targetParticipantIdentity: 'agent'
  });

  // Set action URL for handoff
  twiml.action(baseActionUrl);

  res.type('text/xml');
  res.send(twiml.toString());
});

export default router;
`;

  await fs.writeFile(path.join(routesDir, 'call.ts'), callRouteTemplate);

  // Generate conversationRelay.ts
  const conversationRelayTemplate = `import ExpressWs from 'express-ws';
import { LLMService } from '../llm';
import { getLocalTemplateData } from '../lib/utils/llm/getTemplateData';
import { log } from '../lib/utils/logger';

// Store active conversations
const activeConversations = new Map<string, {
  ws: ExpressWs.WebsocketRequestHandler;
  llm: LLMService | null;
  ttl: number;
}>();

// Store phone logs
const phoneLogs = new Map<string, any[]>();

// Store recent activity
const recentActivity = new Map<string, {
  phoneNumber: string;
  lastActivity: Date;
  isActive: boolean;
}>();

// TTL cleanup interval - runs every 10 minutes
setInterval(() => {
  const totalConnections = activeConversations.size;
  console.log('Starting cleanup check - ' + totalConnections + ' active conversations');

  let expiredCount = 0;
  activeConversations.forEach((conversation, phoneNumber) => {
    if (conversation.ttl < Date.now()) {
      console.log('Closing expired conversation for ' + phoneNumber);
      conversation.ws?.close();
      activeConversations.delete(phoneNumber);

      const existingActivity = recentActivity.get(phoneNumber);
      if (existingActivity) {
        existingActivity.isActive = false;
      }
      expiredCount++;
    }
  });

  console.log('Cleanup complete - removed ' + expiredCount + ' expired conversations');
}, 10 * 60 * 1000);

export const setupConversationRelayRoute = (app: ExpressWs.Application) => {
  app.ws('/conversation-relay', async (ws, req) => {
    const phoneNumber = (req.query.phoneNumber as string) || 'unknown';
    
    console.log('WebSocket connection established for ' + phoneNumber);
    
    // Get template data from local files
    const templateData = await getLocalTemplateData();
    
    // Initialize LLM service
    const llm = new LLMService(phoneNumber, templateData);
    
    // Store the connection
    activeConversations.set(phoneNumber, {
      ws: ws as any,
      llm,
      ttl: Date.now() + (30 * 60 * 1000) // 30 minutes TTL
    });

    // Set up LLM event handlers
    llm.on('text', (chunk: string, isFinal: boolean, fullText?: string) => {
      ws.send(JSON.stringify({
        type: 'text',
        content: chunk,
        isFinal,
        fullText
      }));
    });

    llm.on('handoff', (data: any) => {
      ws.send(JSON.stringify({
        type: 'handoff',
        data
      }));
    });

    llm.on('language', (data: any) => {
      ws.send(JSON.stringify({
        type: 'language',
        data
      }));
    });

    await llm.notifyInitialCallParams();

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        log.info({
          label: 'conversation',
          phone: phoneNumber,
          message: 'Received message',
          data: data.type
        });
        
        // Handle different message types
        if (data.type === 'start') {
          llm.isVoiceCall = true;
          console.log('Starting conversation for ' + phoneNumber);
        } else if (data.type === 'message') {
          llm.addMessage({
            role: 'user',
            content: data.content
          });
          await llm.run();
        } else if (data.type === 'interrupt') {
          // Handle interruption
          console.log('Interrupting conversation for ' + phoneNumber);
        }
      } catch (error) {
        log.error({
          label: 'conversation',
          phone: phoneNumber,
          message: 'Error processing message',
          data: error
        });
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed for ' + phoneNumber);
      activeConversations.delete(phoneNumber);
      
      const existingActivity = recentActivity.get(phoneNumber);
      if (existingActivity) {
        existingActivity.isActive = false;
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error for ' + phoneNumber + ':', error);
      activeConversations.delete(phoneNumber);
    });
  });
};

export { activeConversations, phoneLogs, recentActivity };
`;

  await fs.writeFile(path.join(routesDir, 'conversationRelay.ts'), conversationRelayTemplate);

  // Generate other routes
  const otherRoutes = {
    sms: `import { Router } from 'express';
const router = Router();

router.post('/text', async (req, res) => {
  try {
    const { From: from, Body: body, To: to } = req.body;
    console.log('Received SMS from ' + from + ': ' + body);
    res.status(200).send();
  } catch (error: any) {
    console.error('SMS error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;`,

    liveAgent: `import { Router } from 'express';
import { Twilio } from 'twilio';

const router = Router();

router.post('/live-agent', async (req, res) => {
  const { From: from, To: to, Direction: direction } = req.body;
  const customerNumber = direction?.includes('outbound') ? to : from;

  console.log('Received live agent request:', { from, to, direction, customerNumber });

  const twiml = new Twilio.twiml.VoiceResponse();
  
  if (process.env.TWILIO_WORKFLOW_SID) {
    twiml
      .enqueue({
        workflowSid: process.env.TWILIO_WORKFLOW_SID,
        taskAttributes: JSON.stringify({
          name: customerNumber,
          handoffReason: 'Customer requested live agent',
          reasonCode: 'live_agent_request',
          conversationSummary: 'Customer transferred to live agent'
        })
      });
  } else {
    twiml.say('Please hold while we transfer you to a live agent.');
    twiml.hangup();
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

export default router;`,

    outboundCall: `import { Router } from 'express';
const router = Router();

router.get('/outbound-call', async (req, res) => {
  try {
    res.json({ message: 'Outbound call endpoint' });
  } catch (error: any) {
    console.error('Outbound call error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;`,

    stats: `import { Router } from 'express';
import { activeConversations, recentActivity } from './conversationRelay';

const router = Router();

router.get('/stats', async (req, res) => {
  try {
    const stats = {
      activeConversations: activeConversations.size,
      totalRecentActivity: recentActivity.size,
      timestamp: new Date().toISOString()
    };
    res.json(stats);
  } catch (error: any) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;`,

    activeNumbers: `import { Router } from 'express';
const router = Router();

router.get('/active-numbers', async (req, res) => {
  try {
    res.json({ message: 'Active numbers endpoint' });
  } catch (error: any) {
    console.error('Active numbers error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;`,

    outboundMessage: `import { Router } from 'express';
const router = Router();

router.get('/outbound-message', async (req, res) => {
  try {
    res.json({ message: 'Outbound message endpoint' });
  } catch (error: any) {
    console.error('Outbound message error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;`,

    liveNumbers: `import { Router } from 'express';
const router = Router();

router.get('/live-numbers', async (req, res) => {
  try {
    res.json({ message: 'Live numbers endpoint' });
  } catch (error: any) {
    console.error('Live numbers error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;`
  };

  // Generate other route files
  for (const [routeName, template] of Object.entries(otherRoutes)) {
    const fileName = routeName + '.ts';
    await fs.writeFile(path.join(routesDir, fileName), template);
  }
}

async function generateEnvTemplate(projectPath) {
  const envTemplate = `# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=your_twilio_phone_number_here
TWILIO_CONVERSATION_SERVICE_SID=your_conversation_service_sid_here
TWILIO_WORKFLOW_SID=your_workflow_sid_here

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o

# Server Configuration
PORT=3000
NODE_ENV=development

# URLs (for development and production)
NGROK_URL=your_ngrok_url_here
LIVE_HOST_URL=your_production_domain_here
ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend-domain.com

# Webhook Configuration (optional)
WEBHOOK_URL=your_webhook_url_here

# Segment Configuration (if using Segment tools)
SEGMENT_WRITE_KEY=your_segment_write_key_here
SEGMENT_WORKSPACE=your_segment_workspace_here

# Airtable Configuration (if using Airtable tools)
AIRTABLE_API_KEY=your_airtable_api_key_here
AIRTABLE_BASE_ID=your_airtable_base_id_here

# Email Configuration (if using Email tools)
EMAIL_API_KEY=your_email_api_key_here
EMAIL_FROM_ADDRESS=your_email_from_address_here

# Ngrok Configuration (for development)
NGROK_AUTH_TOKEN=your_ngrok_auth_token_here
`;

  await fs.writeFile(path.join(projectPath, '.env.example'), envTemplate);
}

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

async function initializeGit(projectPath) {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  try {
    await execAsync('git init', { cwd: projectPath });
    await execAsync('git add .', { cwd: projectPath });
    await execAsync('git commit -m "Initial commit from create-twilio-agent"', { cwd: projectPath });
  } catch (error) {
    console.warn('Warning: Could not initialize git repository:', error.message);
  }
}

async function installDependencies(projectPath, config) {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  try {
    const installCommand = config.packageManager === 'yarn' ? 'yarn install' : 
                          config.packageManager === 'pnpm' ? 'pnpm install' : 
                          'npm install';
    
    console.log(`Installing dependencies with ${config.packageManager}...`);
    await execAsync(installCommand, { cwd: projectPath });
  } catch (error) {
    console.warn('Warning: Could not install dependencies:', error.message);
    console.log('Please run the install command manually in the project directory.');
  }
}

module.exports = { generateProject };