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
  // TAC's voiceChannel.handleIncomingCall() creates the Maestro Conversation,
  // adds participants, and returns TwiML — replacing the manual approach.
  const callRouteTemplate = `import { Router } from 'express';
import axios from 'axios';
import { languages } from '../lib/config/languages.js';
import { log } from '../lib/utils/logger.js';
import { voiceChannel } from '../tac.js';

const router = Router();

router.get('/call', async (req: any, res: any) => { await handleCallRequest(req, res); });
router.post('/call', async (req: any, res: any) => { await handleCallRequest(req, res); });

async function handleCallRequest(req: any, res: any) {
  const isProduction = process.env.NODE_ENV === 'production';
  const host = isProduction ? process.env.LIVE_HOST_URL : (process.env.NGROK_URL || req.get('host'));

  const {
    From: fromNumber = '',
    To: toNumber = '',
    Direction: direction = 'inbound',
    CallSid: callSid = '',
  } = { ...req.query, ...req.body } as Record<string, string>;

  const callerNumber = direction.includes('outbound') ? toNumber : fromNumber;

  if (process.env.SEGMENT_WRITE_KEY) {
    axios.post(
      'https://api.segment.io/v1/track',
      {
        userId: callerNumber,
        event: 'Conversation Started',
        properties: { type: 'voice', phoneNumber: callerNumber, direction, timestamp: new Date().toISOString() },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic ' + Buffer.from((process.env.SEGMENT_WRITE_KEY ?? '') + ':').toString('base64'),
        },
      }
    ).catch((err: Error) => log.error({ label: 'call', message: 'Segment track failed', data: err }));
  }

  const wsUrl = \`wss://\${host}/conversation-relay\`;
  const actionUrl = \`https://\${host}/live-agent\`;

  const supportedLanguageCodes = ['en-US','de-DE','fr-FR','es-ES','pt-BR','ja-JP','hi-IN','nl-NL','it-IT','zh-CN'];
  const languageConfigs = languages
    .filter((lang) => supportedLanguageCodes.includes(lang.value))
    .map((lang) => ({
      code: lang.value,
      ttsProvider: 'ElevenLabs',
      transcriptionProvider: 'Deepgram',
      speechModel: 'nova-2-general',
      voice: lang.twilioConfig?.voice ?? 'g6xIsTj2HwM6VR4iXFCw',
    }));

  try {
    const twimlXml = await voiceChannel.handleIncomingCall({
      fromNumber,
      toNumber,
      callSid,
      actionUrl,
      conversationRelayConfig: {
        url: wsUrl,
        ttsProvider: 'ElevenLabs',
        voice: 'g6xIsTj2HwM6VR4iXFCw',
        transcriptionProvider: 'Deepgram',
        speechModel: 'nova-2-general',
        dtmfDetection: true,
        debug: 'true',
        intelligenceService: process.env.TWILIO_CONVERSATIONAL_INTELLIGENCE_SID,
        languages: languageConfigs,
      },
    });

    res.type('text/xml').send(twimlXml);
  } catch (err) {
    log.error({ label: 'call', message: 'handleIncomingCall failed', data: err });
    res.status(500).send('Error generating TwiML');
  }
}

export default router;
`;

  await fs.writeFile(path.join(routesDir, 'call.ts'), callRouteTemplate);

  // conversationRelay.ts is now a thin shim — TAC's VoiceChannel owns all
  // WebSocket state. The WS route itself lives in app.ts.
  // activeConversations/recentActivity are kept as compat exports for stats.ts.
  const conversationRelayTemplate = `import { getActiveVoiceCount } from '../tac.js';

// Backward-compatible shim used by stats.ts.
export const activeConversations = { get size() { return getActiveVoiceCount(); } };
export const recentActivity = { size: 0 };
`;

  await fs.writeFile(
    path.join(routesDir, 'conversationRelay.ts'),
    conversationRelayTemplate
  );

  // Generate other routes
  const otherRoutes = {
    // sms.ts: route is handled in app.ts now; keep file for any future custom SMS logic.
    sms: `// SMS webhook handling is wired directly in app.ts via smsChannel.processWebhook().
// Add any custom SMS-specific logic here if needed.
export {};
`,

    liveAgent: `import { Router } from 'express';
import twilio from 'twilio';

const router = Router();

router.post('/live-agent', async (req: any, res: any) => {
  const { From: from, To: to, Direction: direction } = req.body;
  const customerNumber = direction?.includes('outbound') ? to : from;

  console.log('Received live agent request:', { from, to, direction, customerNumber });

  const twilioTwiml = new twilio.twiml.VoiceResponse();
  
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

router.get('/outbound-call', async (req: any, res: any) => {
  try {
    res.json({ message: 'Outbound call endpoint' });
  } catch (error: any) {
    console.error('Outbound call error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;`,

    stats: `import { Router } from 'express';
import { activeConversations, recentActivity } from './conversationRelay.js';

const router = Router();

router.get('/stats', async (req: any, res: any) => {
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

router.get('/active-numbers', async (req: any, res: any) => {
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

router.get('/outbound-message', async (req: any, res: any) => {
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

router.get('/live-numbers', async (req: any, res: any) => {
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
