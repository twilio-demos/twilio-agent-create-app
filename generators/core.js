const fs = require('fs-extra');
const path = require('path');

async function generateTacFile(projectPath) {
  const srcDir = path.join(projectPath, 'src');
  await fs.ensureDir(srcDir);

  const tacTemplate = `import { TAC, TACConfig, VoiceChannel, SMSChannel } from 'twilio-agent-connect';

// Initialize TAC with config loaded from environment variables.
// Required env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_API_KEY,
// TWILIO_API_TOKEN, TWILIO_PHONE_NUMBER, CONVERSATION_SERVICE_ID
export const tac = new TAC({ config: TACConfig.fromEnv() });

export const voiceChannel = new VoiceChannel(tac);
export const smsChannel = new SMSChannel(tac);

tac.registerChannel(voiceChannel);
tac.registerChannel(smsChannel);

// Track active voice connections for the /stats endpoint.
let activeVoiceCount = 0;
voiceChannel.on('webSocketConnected', () => { activeVoiceCount++; });
voiceChannel.on('webSocketDisconnected', () => { activeVoiceCount--; });
export const getActiveVoiceCount = () => activeVoiceCount;
`;

  await fs.writeFile(path.join(srcDir, 'tac.ts'), tacTemplate);
}

async function generateAppFile(projectPath, config) {
  const srcDir = path.join(projectPath, 'src');
  await fs.ensureDir(srcDir);

  const appTemplate = `import 'dotenv/config';
import express from 'express';
import expressWs from 'express-ws';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import WebSocket from 'ws';

// TAC
import { tac, voiceChannel, smsChannel } from './tac.js';

// Local imports
import { log } from './lib/utils/logger.js';
import { LLMService } from './llm.js';
import { getLocalTemplateData } from './lib/utils/llm/getTemplateData.js';

// Routes
import callRouter from './routes/call.js';
import liveAgentRouter from './routes/liveAgent.js';
import outboundCallRouter from './routes/outboundCall.js';
import statsRouter from './routes/stats.js';
import activeNumbersRouter from './routes/activeNumbers.js';
import outboundMessageRouter from './routes/outboundMessage.js';
import liveNumbersRouter from './routes/liveNumbers.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// ── LLM session management ──────────────────────────────────────────────────
// One LLMService per active conversation, keyed by TAC conversationId.
const llmSessions = new Map<string, LLMService>();

// Voice: TAC fires 'setup' when ConversationRelay WebSocket connects and
// sends its first message. Create the LLMService here so it's ready before
// the first 'prompt' arrives via tac.onMessageReady().
voiceChannel.on('setup', async ({ conversationId, from, to, callSid }: {
  conversationId: string;
  from: string;
  to: string;
  callSid: string;
  profileId?: string;
  customParameters?: Record<string, unknown>;
}) => {
  const templateData = await getLocalTemplateData();
  const llm = new LLMService(from, templateData);

  // Stream text tokens directly through the TAC-managed WebSocket.
  llm.on('text', (chunk: string, isFinal: boolean) => {
    const ws = voiceChannel.getWebsocket(conversationId as any);
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'text', token: chunk, last: isFinal }));
    }
  });

  llm.on('handoff', (data: Record<string, unknown>) => {
    const ws = voiceChannel.getWebsocket(conversationId as any);
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'end', handoffData: JSON.stringify(data) }));
    }
  });

  llm.on('language', (data: { ttsLanguage: string; transcriptionLanguage: string }) => {
    const ws = voiceChannel.getWebsocket(conversationId as any);
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'language',
        ttsLanguage: data.ttsLanguage,
        transcriptionLanguage: data.transcriptionLanguage,
      }));
    }
  });

  // 'inbound' covers the standard case. TAC doesn't surface call direction in
  // the setup callback yet — update when it does.
  await llm.setCallContext(from, to, 'inbound', callSid);
  await llm.notifyInitialCallParams();
  await llm.run(); // initial greeting

  llmSessions.set(conversationId, llm);
});

// All channels: fired every time a user message is ready.
tac.onMessageReady(async ({ conversationId, message, author, channel }) => {
  if (channel === 'voice') {
    const llm = llmSessions.get(conversationId as string);
    if (!llm) {
      log.error({ label: 'tac', message: \`No LLM session for voice conversation \${conversationId}\` });
      return;
    }
    llm.addMessage({ role: 'user', content: message });
    await llm.run();

  } else if (channel === 'sms') {
    let llm = llmSessions.get(conversationId as string);

    if (!llm) {
      // First message in this SMS conversation — bootstrap the LLM session.
      const templateData = await getLocalTemplateData();
      llm = new LLMService(author, templateData);
      llm.isVoiceCall = false;

      // For SMS, wait for the full response then send it as a single message.
      llm.on('text', async (_chunk: string, isFinal: boolean, fullText?: string) => {
        if (isFinal && fullText) {
          await smsChannel.sendResponse(conversationId as any, fullText).catch((err: Error) =>
            log.error({ label: 'sms', message: 'Failed to send SMS response', data: err })
          );
        }
      });

      await llm.notifyInitialCallParams();
      llmSessions.set(conversationId as string, llm);
    }

    llm.addMessage({ role: 'user', content: message });
    await llm.run();
  }
});

// Cancel in-flight LLM generation when the caller interrupts.
tac.onInterrupt(({ conversationId }) => {
  llmSessions.get(conversationId as string)?.cancel();
});

// Clean up LLM state when a conversation ends.
tac.onConversationEnded(({ session }) => {
  llmSessions.delete(session.conversationId as string);
});

// ── Express setup ───────────────────────────────────────────────────────────
const { app } = expressWs(express());

app.use(helmet());
app.use(compression());
app.use(morgan('combined'));

if (process.env.NODE_ENV !== 'production') {
  app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
} else {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? [];
  app.use(cors({ origin: allowedOrigins, credentials: true }));
}

app.use(express.urlencoded({ extended: true })).use(express.json());

// TAC handles all WebSocket state — this route just hands the socket over.
app.ws('/conversation-relay', (ws) => {
  voiceChannel.handleWebSocketConnection(ws as unknown as WebSocket);
});

// SMS: TAC's SMSChannel expects Maestro (Conversation Orchestrator) webhooks,
// not raw Twilio SMS webhooks. Configure your Twilio number to use a
// ConversationConfiguration with capture rules pointing here.
app.post('/text', async (req: any, res: any) => {
  try {
    const idempotencyToken = req.headers['i-twilio-idempotency-token'] as string | undefined;
    await smsChannel.processWebhook(req.body, idempotencyToken);
  } catch (err) {
    log.error({ label: 'sms', message: 'Webhook error', data: err });
  }
  res.type('text/xml').send('<Response/>');
});

// Custom routes (not covered by TAC)
app.use('/', callRouter);
app.use('/', liveAgentRouter);
app.use('/', outboundCallRouter);
app.use('/', statsRouter);
app.use('/', activeNumbersRouter);
app.use('/', outboundMessageRouter);
app.use('/', liveNumbersRouter);

app.get('/health', (_req: any, res: any) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  log.info({ label: 'server', message: \`Server listening on port \${PORT}\` });
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
    this.model = process.env.OPENAI_MODEL || 'gpt-4.1';
  }

  public async setCallContext(from: string, to: string, direction: string, callSid: string) {
    // Add call context like ramp-agent does
    const callerPhoneNumber = direction.includes('outbound') ? to : from;
    const twilioNumber = direction.includes('outbound') ? from : to;
    
    // Store the Twilio number in templateData for tools to use
    if (this.templateData) {
      this.templateData.toolData = this.templateData.toolData || {};
      this.templateData.toolData.twilioNumber = twilioNumber;
    }
    
    this.addMessage({
      role: 'system',
      content: \`The customer's phone number is \${callerPhoneNumber} and the Twilio number you are calling from is \${twilioNumber}. Your call SID is \${callSid}. This is a \${direction} call.\`,
    });
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
      console.log('📝 Adding instructions to LLM memory:');
      console.log('- Instructions length:', this.templateData.instructions.length, 'characters');
      console.log('- Instructions preview:', this.templateData.instructions.substring(0, 200) + '...');
      
      this.addMessage({
        role: 'system',
        content: this.templateData.instructions,
      });
    } else {
      console.log('❌ No instructions found in templateData');
    }

    // Add context from local file
    if (this.templateData?.context) {
      console.log('📋 Adding context to LLM memory:');
      console.log('- Context length:', this.templateData.context.length, 'characters');
      console.log('- Context preview:', this.templateData.context.substring(0, 200) + '...');
      
      this.addMessage({
        role: 'system',
        content: this.templateData.context,
      });
    } else {
      console.log('❌ No context found in templateData');
    }

    console.log('🧠 LLM memory summary:');
    console.log('- Total messages in memory:', this.store.msgs.length);
    console.log('- System messages:', this.store.msgs.filter(m => m.role === 'system').length);
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

  // Abort the current in-flight LLM request (called on voice interrupt).
  public cancel(): void {
    if (this.currentRequest) {
      this.currentRequest.abort();
      this.currentRequest = null;
    }
  }

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

module.exports = { generateTacFile, generateAppFile, generateLlmFile, generateVoicesFile }; 