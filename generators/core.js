const fs = require('fs-extra');
const path = require('path');

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
  on: (typeof this.emitter)['on'] = (...args: any[]) => this.emitter.on(...(args as [any, any]));
  emit: (typeof this.emitter)['emit'] = (...args: any[]) => this.emitter.emit(...(args as [any, ...any[]]));
  removeAllListeners: (typeof this.emitter)['removeAllListeners'] = (...args: any[]) =>
    this.emitter.removeAllListeners(...(args as [any?]));

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

          // Send chunks of text for TTS - only if this is still the current response
          if (
            currentChunk.length >= 10 ||  // Emit every 10 characters (faster)
            content.includes('.') ||
            content.includes('?')
          ) {
            // Only emit text if this is still the current response
            if (this.currentResponseId === responseId) {
              this.emit('text', currentChunk, false);
            } else {
              log.info({
                label: 'llm',
                phone: this.customerNumber,
                message: \`Ignoring text chunk from cancelled response: \${responseId}\`,
              });
            }
            currentChunk = '';
          }
        }
      }

      // Send any remaining text - only if this is still the current response
      if (currentChunk && this.currentResponseId === responseId) {
        this.emit('text', currentChunk, false);
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

module.exports = { generateAppFile, generateLlmFile, generateVoicesFile }; 