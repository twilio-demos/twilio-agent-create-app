const fs = require('fs-extra');
const path = require('path');

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
import { twiml } from 'twilio';
import { languages } from '../lib/config/languages';

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

  const twilioTwiml = new twiml.VoiceResponse();
  
  // Connect to ConversationRelay
  const connect = twilioTwiml.connect({
    action: \`\${baseActionUrl}?method=POST\`,
  });

  // Define comprehensive parameters for the ConversationRelay
  const relayParams = {
    url: relayUrl,
    voice: 'g6xIsTj2HwM6VR4iXFCw', // Default ElevenLabs voice for English
    transcriptionProvider: 'Deepgram', // Primary transcription provider
    ttsProvider: 'ElevenLabs', // Text-to-Speech provider
    speechModel: 'nova-2-general', // Speech model for transcription
    dtmfDetection: true, // DTMF detection enabled
    debug: 'true', // Debugging enabled for troubleshooting (string type)
  };

  
  const conversationRelay = connect.conversationRelay(relayParams);
  console.log('✅ ConversationRelay created successfully');

  // Configure supported languages for TwiML
  try {

    
    // Filter to working languages (those with proper Twilio configuration)
    const workingLanguages = languages.filter(
      (lang) =>
        lang.value === 'en-US' ||
        lang.value === 'de-DE' ||
        lang.value === 'fr-FR' ||
        lang.value === 'es-ES' ||
        lang.value === 'pt-BR' ||
        lang.value === 'ja-JP' ||
        lang.value === 'hi-IN' ||
        lang.value === 'nl-NL' ||
        lang.value === 'it-IT' ||
        lang.value === 'zh-CN'
    );


    // Configure each language individually
    let configuredCount = 0;
    let failedCount = 0;
    
    workingLanguages.forEach((language, index) => {
      try {
        // Build language configuration with detailed settings
        const languageConfig = {
          code: language.value,
          ttsProvider: relayParams.ttsProvider, // Use default from relayParams
          transcriptionProvider: relayParams.transcriptionProvider, // Use default from relayParams
          speechModel: relayParams.speechModel, // Use default from relayParams
          voice: language.twilioConfig.voice || relayParams.voice,
        };


        // Add language to ConversationRelay
        conversationRelay.language(languageConfig);
        configuredCount++;
        
      } catch (languageError) {
        failedCount++;
        console.error(\`❌ Failed to configure language \${language.value}:\`, languageError);
      }
    });

    console.log(\`📊 Language configuration summary:\`);
    console.log(\`   - Successfully configured: \${configuredCount} languages\`);
    console.log(\`   - Failed: \${failedCount} languages\`);
    console.log(\`   - Total attempted: \${workingLanguages.length} languages\`);
    
    if (configuredCount === 0) {
      throw new Error('No languages were successfully configured');
    }
    
  } catch (error) {
    console.error('❌ Critical error during language configuration:', error);

    // Fallback to English-only configuration
    console.log('🔄 Implementing fallback: English-only configuration...');
    
    try {
      const fallbackConfig = {
        code: 'en-US',
        ttsProvider: 'ElevenLabs',
        voice: 'g6xIsTj2HwM6VR4iXFCw',
        transcriptionProvider: 'Deepgram',
        speechModel: 'nova-2-general',
      };
      
      console.log('🔄 Fallback language config:', fallbackConfig);
      conversationRelay.language(fallbackConfig);
      console.log('✅ Fallback English configuration applied successfully');
    } catch (fallbackError) {
      console.error('💥 CRITICAL: Even fallback configuration failed:', fallbackError);
      // Continue anyway - let Twilio handle with defaults
    }
  }

  // Send response
  res.type('text/xml');
  res.send(twilioTwiml.toString());
  
  console.log('📤 TwiML response sent successfully');
});

export default router;
`;

  await fs.writeFile(path.join(routesDir, 'call.ts'), callRouteTemplate);

  // Generate conversationRelay.ts
  const conversationRelayTemplate = `import ExpressWs from 'express-ws';
import WebSocket from 'ws';
import { LLMService } from '../llm';
import { getLocalTemplateData } from '../lib/utils/llm/getTemplateData';
import { log } from '../lib/utils/logger';

// Store active conversations
const activeConversations = new Map<string, {
  ws: WebSocket;
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
    let phoneNumber: string = 'unknown';
    let llm: LLMService;
    
    console.log('WebSocket connection established');
    
    // Get template data from local files
    const templateData = await getLocalTemplateData();

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        log.info({
          label: 'conversation',
          phone: phoneNumber,
          message: 'Received message',
          data: data.type
        });
        
        // Handle different message types from Twilio ConversationRelay
        if (data.type === 'setup') {
          // Extract phone number from setup message
          const { from, to, direction } = data;
          
          if (direction && direction.includes('outbound')) {
            // For outbound calls, the customer is the 'to' number
            phoneNumber = to;
            console.log('Outbound call detected. Customer number: ' + phoneNumber + ', Twilio number: ' + from);
          } else {
            // For inbound calls, the customer is the 'from' number
            phoneNumber = from;
            console.log('Inbound call detected. Customer number: ' + phoneNumber + ', Twilio number: ' + to);
          }
          
          // Initialize LLM service with the correct phone number
          llm = new LLMService(phoneNumber, templateData);
          
          // Store the connection
          activeConversations.set(phoneNumber, {
            ws,
            llm,
            ttl: Date.now() + (30 * 60 * 1000) // 30 minutes TTL
          });
          
          // Set up LLM event handlers
          llm.on('text', (chunk: string, isFinal: boolean, fullText?: string) => {
            // Send text token to Twilio ConversationRelay
            // Format should be { type: 'text', token, last }
            ws.send(JSON.stringify({
              type: 'text',
              token: chunk,
              last: isFinal
            }));
          });

          llm.on('handoff', (data: any) => {
            ws.send(JSON.stringify({
              type: 'handoff',
              data
            }));
          });

          llm.on('language', (data: any) => {
            const languageMessage = {
              type: 'language' as const,
              ttsLanguage: data.ttsLanguage,
              transcriptionLanguage: data.transcriptionLanguage,
            };

            console.log('Sending language message to Twilio:', languageMessage);
            ws.send(JSON.stringify(languageMessage));
          });

          // Start the conversation
          llm.isVoiceCall = true;
          console.log('Starting conversation for ' + phoneNumber);
          await llm.notifyInitialCallParams();
          await llm.run();
        } else if (data.type === 'message') {
          // User speech message
          if (!llm) {
            console.log('LLM not initialized yet, ignoring message');
            return;
          }
          llm.addMessage({
            role: 'user',
            content: data.content || data.message || ''
          });
          await llm.run();
        } else if (data.type === 'interrupt') {
          // Handle interruption
          if (!llm) {
            console.log('LLM not initialized yet, ignoring interrupt');
            return;
          }
          console.log('Interrupting conversation for ' + phoneNumber);
          // Optionally restart the LLM response
          await llm.run();
        } else if (data.type === 'dtmf') {
          // Handle DTMF tones
          if (!llm) {
            console.log('LLM not initialized yet, ignoring DTMF');
            return;
          }
          console.log('DTMF received: ' + data.digit);
          llm.addMessage({
            role: 'user',
            content: \`DTMF: \${data.digit}\`
          });
          await llm.run();
        } else if (data.type === 'prompt') {
          // User speech prompt from Twilio ConversationRelay
          if (!llm) {
            console.log('LLM not initialized yet, ignoring prompt');
            return;
          }
          console.log('Received voice prompt:', data.voicePrompt);
          llm.addMessage({
            role: 'user',
            content: data.voicePrompt || ''
          });
          await llm.run();
        } else if (data.type === 'info') {
          // Handle info messages (heartbeat/status updates from Twilio)
          console.log('📊 Info message from Twilio for ' + phoneNumber + ':', {
            timestamp: new Date().toISOString(),
            data: data
          });
        } else if (data.type === 'error') {
          console.error('Error from Twilio:', data.description);
        } else {
          console.log('Unhandled message type:', data.type);
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

  await fs.writeFile(
    path.join(routesDir, 'conversationRelay.ts'),
    conversationRelayTemplate
  );

  // Generate other routes
  const otherRoutes = {
    sms: `import { Router } from 'express';
import twilio from 'twilio';

// Local imports
import { getLocalTemplateData } from '../lib/utils/llm/getTemplateData';
import { activeConversations } from './conversationRelay';
import { LLMService } from '../llm';
import { routeNames } from './routeNames';

const router = Router();

router.post(\`/\${routeNames.sms}\`, async (req, res) => {
  try {
    const callType =
      req.body.To.includes('whatsapp:') || req.body.From.includes('whatsapp:')
        ? 'whatsapp'
        : 'sms';

    const { From: from, Body: body, To: to } = req.body;

    // Validate required fields at the top
    if (!from || !body) {
      console.error('Missing required fields:', { from, body });
      return res.status(400).send('Missing required fields');
    }

    console.log('Received SMS from ' + from + ': ' + body);

    // Check if there's an active conversation for this number
    const conversation = activeConversations.get(from);

    if (conversation && conversation.llm) {
      const { llm } = conversation;

      // Add message to conversation history
      llm.addMessage({
        role: 'user',
        content: body,
      });

      // Process with LLM
      await llm.run();
    } else {
      // Create new conversation for this number
      const templateData = await getLocalTemplateData();
      const llm = new LLMService(from, templateData);

      // Reset voice call flag for SMS conversations
      llm.isVoiceCall = false;

      // Store the conversation
      activeConversations.set(from, {
        ws: null as any, // No WebSocket for SMS-only conversations
        llm,
        ttl: Date.now() + 60 * 60 * 1000, // TTL: current time + 1 hour
      });

      llm.addMessage({
        role: 'system',
        content: \`The customer's phone number is \${from}. 
        The agent's phone number is \${to}.
        This is an \${callType} conversation.\`,
      });

      // Add user's message and start conversation
      llm.addMessage({
        role: 'user',
        content: body,
      });

      await llm.run();
    }

    // Send TwiML response
    const twiml = new twilio.twiml.MessagingResponse();
    res.type('text/xml');
    return res.send(twiml.toString());
  } catch (error: any) {
    console.error('SMS error:', error);
    return res.status(500).send('Error processing message');
  }
});

export default router;`,

    liveAgent: `import { Router } from 'express';
import { twiml } from 'twilio';

const router = Router();

router.post('/live-agent', async (req, res) => {
  const { From: from, To: to, Direction: direction } = req.body;
  const customerNumber = direction?.includes('outbound') ? to : from;

  console.log('Received live agent request:', { from, to, direction, customerNumber });

  const twilioTwiml = new twiml.VoiceResponse();
  
  if (process.env.TWILIO_WORKFLOW_SID) {
    const enqueue = twilioTwiml.enqueue({ 
      workflowSid: process.env.TWILIO_WORKFLOW_SID 
    });
    enqueue.task(JSON.stringify({
      name: customerNumber,
      handoffReason: 'Customer requested live agent',
      reasonCode: 'live_agent_request',
      conversationSummary: 'Customer transferred to live agent'
    }));
  } else {
    twilioTwiml.say('Please hold while we transfer you to a live agent.');
    twilioTwiml.hangup();
  }

  res.type('text/xml');
  res.send(twilioTwiml.toString());
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

export default router;`,
  };

  // Generate other route files
  for (const [routeName, template] of Object.entries(otherRoutes)) {
    const fileName = routeName + '.ts';
    await fs.writeFile(path.join(routesDir, fileName), template);
  }
}

module.exports = { generateRoutes };
