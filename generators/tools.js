const fs = require('fs-extra');
const path = require('path');

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
import { ToolResult } from '../../lib/types';

export async function execute(
  args: { to: string; message: string },
  toolData: any
): Promise<ToolResult> {
  const { to, message } = args;
  
  try {
    // Get Twilio credentials from environment variables
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioConversationNumber = process.env.TWILIO_CONVERSATION_NUMBER;
    
    if (!twilioAccountSid) {
      throw new Error('Missing TWILIO_ACCOUNT_SID environment variable');
    }
    
    if (!twilioAuthToken) {
      throw new Error('Missing TWILIO_AUTH_TOKEN environment variable');
    }
    
    if (!twilioConversationNumber) {
      throw new Error('Missing TWILIO_CONVERSATION_NUMBER environment variable');
    }
    
    if (!message || !to) {
      return {
        success: false,
        error: 'Message and phone number are required',
      };
    }
    
    const client = new Twilio(twilioAccountSid, twilioAuthToken);
    
    const result = await client.messages.create({
      body: message,
      to: to,
      from: twilioConversationNumber
    });
    
    return {
      success: true,
      data: {
        messageId: result.sid,
        status: result.status,
        message: 'Message sent successfully'
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to send message'
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
      executor: `// External npm packages
import twilio from 'twilio';

// Local imports
import { ToolResult, LocalTemplateData } from '../../lib/types';

export type SendRCSParams = {
  to: string;
  content?: string;
  contentSid?: string;
  messagingServiceSid?: string;
  contentVariables?: Record<string, string>;
};

function getToolEnvData(toolData: LocalTemplateData['toolData']) {
  const {
    twilioAccountSid: twilioAccountSidEnv,
    twilioAuthToken: twilioAuthTokenEnv,
  } = process.env;

  return {
    twilioContentSid: toolData?.twilioContentSid || process.env.TWILIO_CONTENT_SID,
    twilioMessagingServiceSid: toolData?.twilioMessagingServiceSid || process.env.TWILIO_MESSAGING_SERVICE_SID,
    twilioAccountSid: toolData?.twilioAccountSid || twilioAccountSidEnv,
    twilioAuthToken: toolData?.twilioAuthToken || twilioAuthTokenEnv,
  };
}

export async function execute(
  args: Record<string, unknown>,
  toolData: LocalTemplateData['toolData']
): Promise<ToolResult> {
  const { to, content, contentVariables } = args as SendRCSParams;
  const {
    twilioContentSid,
    twilioMessagingServiceSid,
    twilioAccountSid,
    twilioAuthToken,
  } = getToolEnvData(toolData);

  try {
    if (!twilioContentSid) {
      throw new Error(
        \`Missing RCS Template Content SID. Please provide TWILIO_CONTENT_SID in environment\`
      );
    }

    if (!twilioMessagingServiceSid) {
      throw new Error(
        \`Missing RCS Template Messaging Service SID. Please provide TWILIO_MESSAGING_SERVICE_SID in environment\`
      );
    }

    if (!twilioAccountSid || !twilioAuthToken) {
      throw new Error(
        \`Missing \${
          !twilioAccountSid ? 'TWILIO_ACCOUNT_SID' : 'TWILIO_AUTH_TOKEN'
        }\`
      );
    }

    const twilioClient = twilio(twilioAccountSid, twilioAuthToken);

    const messageData = await twilioClient.messages.create({
      to,
      contentSid: twilioContentSid,
      messagingServiceSid: twilioMessagingServiceSid,
      contentVariables: JSON.stringify({
        ...contentVariables,
        content: contentVariables?.content || content,
      }),
    });
    return {
      success: true,
      data: { message: 'Message sent successfully', content: messageData },
    };
  } catch (err) {
    let errorMessage = 'Failed to send RCS';
    errorMessage =
      err instanceof Error ? err.message : JSON.stringify(err) || errorMessage;

    return {
      success: false,
      error: errorMessage,
    };
  }
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
      executor: `// Local imports
import { ToolResult, LocalTemplateData } from '../../lib/types';

export type SendToLiveAgentParams = {
  callSid: string;
  reason?: string;
  reasonCode?: string;
  conversationSummary?: string;
};

export async function execute(
  args: Record<string, unknown>,
  toolData: LocalTemplateData['toolData']
): Promise<ToolResult> {
  try {
    const { callSid, reason, reasonCode, conversationSummary } =
      args as SendToLiveAgentParams;

    if (!callSid) {
      throw new Error('Call SID is required for live agent handoff');
    }

    // Return the handoff data that will be used by the WebSocket to trigger the handoff
    // Note: targetWorker will be added by the conversation relay from stored configuration
    return {
      success: true,
      data: {
        callSid,
        reason: reason || 'Customer requested live agent',
        reasonCode: reasonCode || 'CUSTOMER_REQUEST',
        conversationSummary: conversationSummary || 'No summary provided',
      },
    };
  } catch (err) {
    let errorMessage = 'Failed to transfer to live agent';
    errorMessage =
      err instanceof Error ? err.message : JSON.stringify(err) || errorMessage;

    return {
      success: false,
      error: errorMessage,
    };
  }
}`
    },
    
    switchLanguage: {
      manifest: `import { ToolManifest } from '../../lib/types';

export const switchLanguageManifest: ToolManifest = {
  type: 'function',
  function: {
    name: 'switchLanguage',
    description: 'Switch conversation language for both TTS and transcription',
    parameters: {
      type: 'object',
      properties: {
        ttsLanguage: {
          type: 'string',
          description: 'Target language code for text-to-speech',
          enum: ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN']
        },
        transcriptionLanguage: {
          type: 'string',
          description: 'Target language code for speech transcription',
          enum: ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN']
        }
      },
      required: ['ttsLanguage', 'transcriptionLanguage']
    }
  }
};`,
      executor: `import { SwitchLanguageParams, ToolResult } from '../../lib/types';
import {
  LANGUAGE_CODE_MAP,
  isLanguageSupported,
  getLanguageLabel,
} from '../../lib/config/languages';

export async function execute(
  args: Record<string, any>,
  toolData: any
): Promise<ToolResult> {
  try {
    const { ttsLanguage, transcriptionLanguage } = args as SwitchLanguageParams;

    if (!ttsLanguage || !transcriptionLanguage) {
      return {
        success: false,
        error: 'Both ttsLanguage and transcriptionLanguage are required',
      };
    }

    // Normalize language codes
    const normalizedTtsLanguage = LANGUAGE_CODE_MAP[ttsLanguage] || ttsLanguage;
    const normalizedTranscriptionLanguage =
      LANGUAGE_CODE_MAP[transcriptionLanguage] || transcriptionLanguage;

    // Validate language codes using centralized configuration
    if (!isLanguageSupported(normalizedTtsLanguage)) {
      return {
        success: false,
        error: \`Unsupported TTS language: \${normalizedTtsLanguage}. Supported languages: \${Object.keys(
          LANGUAGE_CODE_MAP
        ).join(', ')}\`,
      };
    }

    if (!isLanguageSupported(normalizedTranscriptionLanguage)) {
      return {
        success: false,
        error: \`Unsupported transcription language: \${normalizedTranscriptionLanguage}. Supported languages: \${Object.keys(
          LANGUAGE_CODE_MAP
        ).join(', ')}\`,
      };
    }

    // Warn if languages don't match (AI might not understand speech in target language)
    const warning =
      normalizedTtsLanguage !== normalizedTranscriptionLanguage
        ? \`Warning: TTS language (\${normalizedTtsLanguage}) differs from transcription language (\${normalizedTranscriptionLanguage}). The AI may not understand speech in the target language.\`
        : null;

    // Return success with language data - the actual emission will be handled by the LLM service
    return {
      success: true,
      data: {
        message: \`Language switched to \${getLanguageLabel(
          normalizedTranscriptionLanguage
        )}\`,
        ttsLanguage: normalizedTtsLanguage,
        transcriptionLanguage: normalizedTranscriptionLanguage,
        warning,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to switch language',
    };
  }
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
        phone: {
          type: 'string',
          description: 'Phone number to look up'
        }
      },
      required: ['phone']
    }
  }
};`,
      executor: `// External npm packages
import axios from 'axios';

// Local imports
import { ToolResult, LocalTemplateData } from '../../lib/types';
import { sendToWebhook } from '../../lib/utils/webhook';

export interface SegmentProfile {
  traits: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    [key: string]: any;
  };
}

export type GetSegmentProfileParams = {
  phone: string;
};

function getToolEnvData(toolData: LocalTemplateData['toolData']) {
  const {
    segmentWriteKey: segmentWriteKeyEnv,
  } = process.env;

  // For Segment Profile, we need space and token
  // These would typically come from environment or toolData
  const spaceProfile = process.env.SEGMENT_SPACE;
  const tokenProfile = process.env.SEGMENT_TOKEN;

  return {
    spaceProfile,
    tokenProfile,
    segmentWriteKey: toolData?.segmentWriteKey || segmentWriteKeyEnv,
  };
}

export async function execute(
  args: Record<string, unknown>,
  toolData: LocalTemplateData['toolData']
): Promise<ToolResult> {
  const { phone } = args as GetSegmentProfileParams;
  const { spaceProfile, tokenProfile } = getToolEnvData(toolData);

  try {
    if (!spaceProfile) {
      throw new Error(
        \`Missing Segment Space. Please provide SEGMENT_SPACE in environment\`
      );
    }

    if (!tokenProfile) {
      throw new Error(
        \`Missing Segment Token. Please provide SEGMENT_TOKEN in environment\`
      );
    }

    const encodedPhone = encodeURIComponent(phone);
    const URL = \`https://profiles.segment.com/v1/spaces/\${spaceProfile}/collections/users/profiles/phone:\${encodedPhone}/traits?limit=200\`;
    const response = await axios.get<{ traits: SegmentProfile['traits'] }>(
      URL,
      {
        auth: {
          username: tokenProfile,
          password: '',
        },
      }
    );

    const customerData = response.data.traits;

    await sendToWebhook(
      {
        sender: 'system:customer_profile',
        type: 'JSON',
        message: JSON.stringify({ customerData: customerData }),
        phoneNumber: phone,
      },
      process.env.WEBHOOK_URL
    ).catch((err) => console.error('Failed to send to webhook:', err));

    return {
      success: true,
      data: customerData,
    };
  } catch (err) {
    let errorMessage = 'Failed to get Segment record';
    errorMessage =
      err instanceof Error ? err.message : JSON.stringify(err) || errorMessage;

    return {
      success: false,
      error: errorMessage,
    };
  }
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
  
  // Generate additional tools with real implementations if selected
  const additionalTools = {
    sendEmail: {
      manifest: `import { ToolManifest } from '../../lib/types';

export const sendEmailManifest: ToolManifest = {
  type: 'function',
  function: {
    name: 'sendEmail',
    description: 'Send email via SendGrid',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Email address to send to'
        },
        subject: {
          type: 'string',
          description: 'Email subject'
        },
        content: {
          type: 'string',
          description: 'Email content'
        },
        contentVariables: {
          type: 'object',
          description: 'Template variables for SendGrid'
        }
      },
      required: ['to', 'subject']
    }
  }
};`,
      executor: `import sgMail from '@sendgrid/mail';
import { ToolResult, LocalTemplateData } from '../../lib/types';

export type SendEmailParams = {
  to: string;
  subject: string;
  content?: string;
  contentVariables?: Record<string, string>;
};

function getToolEnvData(toolData: LocalTemplateData['toolData']) {
  const {
    sendGridApiKey: sendGridApiKeyEnv,
    sendGridDomain: sendGridDomainEnv,
    sendGridTemplateId: sendGridTemplateIdEnv,
  } = process.env;

  return {
    sendGridApiKey: toolData?.sendGridApiKey || sendGridApiKeyEnv,
    sendGridDomain: toolData?.sendGridDomain || sendGridDomainEnv,
    sendGridTemplateId: toolData?.sendGridTemplateId || sendGridTemplateIdEnv,
  };
}

export async function execute(
  args: Record<string, unknown>,
  toolData: LocalTemplateData['toolData']
): Promise<ToolResult> {
  const { to, subject, content, contentVariables } = args as SendEmailParams;
  const { sendGridApiKey, sendGridDomain, sendGridTemplateId } =
    getToolEnvData(toolData);

  try {
    const missingParams: string[] = [];

    if (!sendGridApiKey) {
      missingParams.push('SendGrid API Key (SENDGRID_API_KEY)');
    }

    if (!sendGridDomain) {
      missingParams.push('SendGrid Domain (SENDGRID_DOMAIN)');
    }

    if (!to) {
      missingParams.push('to (email address)');
    }
    if (!subject) {
      missingParams.push('subject');
    }
    if (!content && !contentVariables) {
      missingParams.push('content or contentVariables');
    }

    if (missingParams.length > 0) {
      throw new Error(
        \`Missing required parameters: \${missingParams.join(', ')}\`
      );
    }

    sgMail.setApiKey(sendGridApiKey!);

    let msg = {} as sgMail.MailDataRequired;

    // Internal email system seem to block Sendgrid
    if (
      sendGridTemplateId &&
      !to.includes('@twilio.com') &&
      !to.includes('@segment.com')
    ) {
      msg = {
        to: to!,
        from: sendGridDomain!,
        templateId: sendGridTemplateId!,
        dynamicTemplateData: {
          ...contentVariables,
          content: contentVariables?.content || content,
          subject,
        },
      };
    } else {
      msg = {
        to: to!,
        from: sendGridDomain!,
        subject: subject!,
        html: \`<div>\${contentVariables?.content || content}</div>\`,
      };
    }

    const result = await sgMail.send(msg);

    return {
      success: true,
      data: { message: 'Email sent successfully', result },
    };
  } catch (err) {
    let errorMessage = 'Failed to send email';
    errorMessage =
      err instanceof Error ? err.message : JSON.stringify(err) || errorMessage;

    return {
      success: false,
      error: errorMessage,
    };
  }
}`
    },
    getSegmentEvents: {
      manifest: `import { ToolManifest } from '../../lib/types';

export const getSegmentEventsManifest: ToolManifest = {
  type: 'function',
  function: {
    name: 'getSegmentEvents',
    description: 'Get Segment user events',
    parameters: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Phone number to look up events for'
        }
      },
      required: ['phone']
    }
  }
};`,
      executor: `// External npm packages
import axios from 'axios';

// Local imports
import { ToolResult, LocalTemplateData } from '../../lib/types';
import { sendToWebhook } from '../../lib/utils/webhook';

export type GetSegmentEventsParams = {
  phone: string;
};

function getToolEnvData(toolData: LocalTemplateData['toolData']) {
  const {
    segmentWriteKey: segmentWriteKeyEnv,
  } = process.env;

  // For Segment Events, we need space and token
  const spaceEvents = process.env.SEGMENT_SPACE;
  const tokenEvents = process.env.SEGMENT_TOKEN;

  return {
    spaceEvents,
    tokenEvents,
    segmentWriteKey: toolData?.segmentWriteKey || segmentWriteKeyEnv,
  };
}

export async function execute(
  args: Record<string, unknown>,
  toolData: LocalTemplateData['toolData']
): Promise<ToolResult> {
  const { phone } = args as GetSegmentEventsParams;
  const { spaceEvents, tokenEvents } = getToolEnvData(toolData);

  try {
    if (!spaceEvents) {
      throw new Error(
        \`Missing Segment Space. Please provide SEGMENT_SPACE in environment\`
      );
    }

    if (!tokenEvents) {
      throw new Error(
        \`Missing Segment Token. Please provide SEGMENT_TOKEN in environment\`
      );
    }

    if (!phone) {
      throw new Error('Phone number is required');
    }

    const encodedPhone = encodeURIComponent(phone);
    const URL = \`https://profiles.segment.com/v1/spaces/\${spaceEvents}/collections/users/profiles/phone:\${encodedPhone}/events?limit=50\`;
    const response = await axios.get<{ data: any[] }>(URL, {
      auth: {
        username: tokenEvents,
        password: '',
      },
    });
    
    // Function to reduce event objects to only include timestamp, event, and properties
    const reduceEventData = (events: any[]): any[] => {
      return events.map((event) => ({
        timestamp: event.timestamp,
        event: event.event,
        properties: event.properties,
      }));
    };
    let eventsData = reduceEventData(response.data.data);

    await sendToWebhook(
      {
        sender: 'system:customer_events',
        type: 'JSON',
        message: JSON.stringify({ eventsData: eventsData }),
        phoneNumber: phone,
      },
      process.env.WEBHOOK_URL
    ).catch((err) => console.error('Failed to send to webhook:', err));

    return {
      success: true,
      data: eventsData,
    };
  } catch (err) {
    let errorMessage = 'Failed to get Segment events';
    errorMessage =
      err instanceof Error ? err.message : JSON.stringify(err) || errorMessage;

    return {
      success: false,
      error: errorMessage,
    };
  }
}`
    },
    updateSegmentProfile: {
      manifest: `import { ToolManifest } from '../../lib/types';

export const updateSegmentProfileManifest: ToolManifest = {
  type: 'function',
  function: {
    name: 'updateSegmentProfile',
    description: 'Update Segment user profile traits',
    parameters: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Phone number to update'
        },
        traits: {
          type: 'object',
          description: 'Traits to update'
        }
      },
      required: ['phone']
    }
  }
};`,
      executor: `// External npm packages
import axios from 'axios';

// Local imports
import { ToolResult, LocalTemplateData } from '../../lib/types';
import { sendToWebhook } from '../../lib/utils/webhook';

export type UpdateSegmentProfileParams = {
  phone: string;
  traits: Record<string, any>;
};

function getToolEnvData(toolData: LocalTemplateData['toolData']) {
  const {
    segmentWriteKey: segmentWriteKeyEnv,
  } = process.env;

  return {
    segmentWriteKeyUpdate: toolData?.segmentWriteKey || segmentWriteKeyEnv,
  };
}

export async function execute(
  args: Record<string, unknown>,
  toolData: LocalTemplateData['toolData']
): Promise<ToolResult> {
  const { phone, traits, ...otherArgs } = args as UpdateSegmentProfileParams &
    Record<string, any>;
  const { segmentWriteKeyUpdate } = getToolEnvData(toolData);

  try {
    if (!segmentWriteKeyUpdate) {
      throw new Error(
        \`Missing Segment Write Key. Please provide SEGMENT_WRITE_KEY in environment\`
      );
    }

    if (!phone) {
      throw new Error('Phone number is required');
    }

    // Extract traits - either from traits object or from other arguments
    const traitsToUpdate = traits || otherArgs;

    if (!traitsToUpdate || Object.keys(traitsToUpdate).length === 0) {
      throw new Error('At least one trait must be provided');
    }

    // Create the identify payload for Segment
    const identifyPayload = {
      userId: phone,
      traits: {
        ...traitsToUpdate,
        phone: phone,
      },
    };

    // Send identify call to Segment
    const response = await axios.post(
      'https://api.segment.io/v1/identify',
      identifyPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: \`Basic \${Buffer.from(
            segmentWriteKeyUpdate + ':'
          ).toString('base64')}\`,
        },
      }
    );

    if (response.status !== 200) {
      throw new Error(\`Segment API returned status \${response.status}\`);
    }

    await sendToWebhook(
      {
        sender: 'system:update_segment_profile',
        type: 'JSON',
        message: JSON.stringify({
          phone: phone,
          updatedTraits: traitsToUpdate,
          success: true,
        }),
        phoneNumber: phone,
      },
      process.env.WEBHOOK_URL
    ).catch((err) => console.error('Failed to send to webhook:', err));

    return {
      success: true,
      data: {
        message: 'Profile traits updated successfully',
        phone: phone,
        updatedTraits: traitsToUpdate,
      },
    };
  } catch (err) {
    let errorMessage = 'Failed to update Segment profile';
    errorMessage =
      err instanceof Error ? err.message : JSON.stringify(err) || errorMessage;

    return {
      success: false,
      error: errorMessage,
    };
  }
}`
    },
    postSegmentTrack: {
      manifest: `import { ToolManifest } from '../../lib/types';

export const postSegmentTrackManifest: ToolManifest = {
  type: 'function',
  function: {
    name: 'postSegmentTrack',
    description: 'Track event in Segment',
    parameters: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Phone number to track for'
        },
        event: {
          type: 'string',
          description: 'Event name to track'
        },
        properties: {
          type: 'object',
          description: 'Event properties'
        }
      },
      required: ['phone', 'event']
    }
  }
};`,
      executor: `// External npm packages
import axios from 'axios';

// Local imports
import { ToolResult, LocalTemplateData } from '../../lib/types';
import { sendToWebhook } from '../../lib/utils/webhook';

export type PostSegmentTrackParams = {
  phone: string;
  event: string;
  properties?: Record<string, any>;
};

function getToolEnvData(toolData: LocalTemplateData['toolData']) {
  const {
    segmentWriteKey: segmentWriteKeyEnv,
  } = process.env;

  return {
    segmentWriteKeyTrack: toolData?.segmentWriteKey || segmentWriteKeyEnv,
  };
}

export async function execute(
  args: Record<string, unknown>,
  toolData: LocalTemplateData['toolData']
): Promise<ToolResult> {
  const { phone, event, properties, ...otherArgs } =
    args as PostSegmentTrackParams & Record<string, any>;
  const { segmentWriteKeyTrack } = getToolEnvData(toolData);

  try {
    if (!segmentWriteKeyTrack) {
      throw new Error(
        \`Missing Segment Write Key. Please provide SEGMENT_WRITE_KEY in environment\`
      );
    }

    if (!phone) {
      throw new Error('Phone number is required');
    }

    if (!event) {
      throw new Error('Event name is required');
    }

    // Extract properties - either from properties object or from other arguments
    const eventProperties = properties || otherArgs;

    // Create the track payload for Segment
    const trackPayload = {
      userId: phone,
      event: event,
      properties: {
        ...(eventProperties || {}),
        phone: phone,
      },
    };

    // Send track call to Segment
    const response = await axios.post(
      'https://api.segment.io/v1/track',
      trackPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: \`Basic \${Buffer.from(
            segmentWriteKeyTrack + ':'
          ).toString('base64')}\`,
        },
      }
    );

    if (response.status !== 200) {
      throw new Error(\`Segment API returned status \${response.status}\`);
    }

    await sendToWebhook(
      {
        sender: 'system:segment_track',
        type: 'JSON',
        message: JSON.stringify({
          phone: phone,
          event: event,
          properties: eventProperties,
          success: true,
        }),
        phoneNumber: phone,
      },
      process.env.WEBHOOK_URL
    ).catch((err) => console.error('Failed to send to webhook:', err));

    return {
      success: true,
      data: {
        message: 'Track event sent successfully',
        phone: phone,
        event: event,
        properties: eventProperties,
      },
    };
  } catch (err) {
    let errorMessage = 'Failed to send Segment track event';
    errorMessage =
      err instanceof Error ? err.message : JSON.stringify(err) || errorMessage;

    return {
      success: false,
      error: errorMessage,
    };
  }
}`
    },
    getAirtableData: {
      manifest: `import { ToolManifest } from '../../lib/types';

export const getAirtableDataManifest: ToolManifest = {
  type: 'function',
  function: {
    name: 'getAirtableData',
    description: 'Get data from Airtable',
    parameters: {
      type: 'object',
      properties: {
        phoneNumber: {
          type: 'string',
          description: 'Phone number to look up'
        }
      },
      required: ['phoneNumber']
    }
  }
};`,
      executor: `// External npm packages
import Airtable from 'airtable';

// Local imports
import { ToolResult, LocalTemplateData } from '../../lib/types';
import { sendToWebhook } from '../../lib/utils/webhook';

export type GetAirtableDataParams = {
  phoneNumber: string;
};

function getToolEnvData(toolData: LocalTemplateData['toolData']) {
  const {
    airtableApiKey: airTableApiKeyEnv,
    airtableBaseId: airTableBaseIdEnv,
    airtableBaseName: airTableNameEnv,
  } = process.env;

  return {
    airTableApiKeyGet: toolData?.airtableApiKey || airTableApiKeyEnv,
    airTableBaseIdGet: toolData?.airtableBaseId || airTableBaseIdEnv,
    airTableNameGet: toolData?.airtableBaseName || airTableNameEnv,
  };
}

export async function execute(
  args: Record<string, unknown>,
  toolData: LocalTemplateData['toolData']
): Promise<ToolResult> {
  const { phoneNumber } = args as GetAirtableDataParams;
  const { airTableApiKeyGet, airTableBaseIdGet, airTableNameGet } =
    getToolEnvData(toolData);

  try {
    if (!airTableApiKeyGet) {
      throw new Error(
        \`Missing Airtable API Key. Please provide AIRTABLE_API_KEY in environment\`
      );
    }

    if (!airTableBaseIdGet) {
      throw new Error(
        \`Missing Airtable Base ID. Please provide AIRTABLE_BASE_ID in environment\`
      );
    }

    if (!airTableNameGet) {
      throw new Error(
        \`Missing Airtable Base Name. Please provide AIRTABLE_BASE_NAME in environment\`
      );
    }

    if (!phoneNumber) {
      throw new Error(\`Missing Phone Number. Please provide in args\`);
    }

    const airtableBase = new Airtable({ apiKey: airTableApiKeyGet }).base(
      airTableBaseIdGet
    );

    const records = await airtableBase(airTableNameGet as string)
      .select({
        filterByFormula: \`{phone} = '\${phoneNumber}'\`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return {
        success: true,
        data: null,
      };
    }

    const record = records[0];
    const rawData = record.fields;

    await sendToWebhook(
      {
        sender: 'system:customer_profile_airtable',
        type: 'JSON',
        message: JSON.stringify({ airtableData: rawData }),
        phoneNumber,
      },
      process.env.WEBHOOK_URL
    ).catch((err) => console.error('Failed to send to webhook:', err));

    return {
      success: true,
      data: rawData,
    };
  } catch (err) {
    let errorMessage = 'Failed to get Airtable record';
    errorMessage =
      err instanceof Error ? err.message : JSON.stringify(err) || errorMessage;

    return {
      success: false,
      error: errorMessage,
    };
  }
}`
    },
    upsertAirtableData: {
      manifest: `import { ToolManifest } from '../../lib/types';

export const upsertAirtableDataManifest: ToolManifest = {
  type: 'function',
  function: {
    name: 'upsertAirtableData',
    description: 'Create or update Airtable record',
    parameters: {
      type: 'object',
      properties: {
        queryField: {
          type: 'string',
          description: 'Field to query by (phone or email)',
          enum: ['phone', 'email']
        },
        queryValue: {
          type: 'string',
          description: 'Value to query for'
        },
        data: {
          type: 'object',
          description: 'Data to insert or update'
        }
      },
      required: ['queryField', 'queryValue', 'data']
    }
  }
};`,
      executor: `// External npm packages
import Airtable from 'airtable';

// Local imports
import { ToolResult, LocalTemplateData } from '../../lib/types';
import { sendToWebhook } from '../../lib/utils/webhook';

export interface UpsertAirtableRecordParams {
  queryField: 'phone' | 'email';
  queryValue: string;
  data: Record<string, string>;
}

function getToolEnvData(toolData: LocalTemplateData['toolData']) {
  const {
    airtableApiKey: airTableApiKeyEnv,
    airtableBaseId: airTableBaseIdEnv,
    airtableBaseName: airTableNameEnv,
  } = process.env;

  return {
    airTableApiKeyUpsert: toolData?.airtableApiKey || airTableApiKeyEnv,
    airTableBaseIdUpsert: toolData?.airtableBaseId || airTableBaseIdEnv,
    airTableNameUpsert: toolData?.airtableBaseName || airTableNameEnv,
  };
}

export async function execute(
  args: Record<string, unknown>,
  toolData: LocalTemplateData['toolData']
): Promise<ToolResult> {
  const { queryField, queryValue, data } = args as unknown as UpsertAirtableRecordParams;
  const { airTableApiKeyUpsert, airTableBaseIdUpsert, airTableNameUpsert } =
    getToolEnvData(toolData);

  try {
    if (!airTableApiKeyUpsert) {
      throw new Error(
        \`Missing Airtable API Key. Please provide AIRTABLE_API_KEY in environment\`
      );
    }

    if (!airTableBaseIdUpsert) {
      throw new Error(
        \`Missing Airtable Base ID. Please provide AIRTABLE_BASE_ID in environment\`
      );
    }

    if (!airTableNameUpsert) {
      throw new Error(
        \`Missing Airtable Base Name. Please provide AIRTABLE_BASE_NAME in environment\`
      );
    }

    const airtableBase = new Airtable({ apiKey: airTableApiKeyUpsert }).base(
      airTableBaseIdUpsert
    );
    const tableName = airTableNameUpsert as string;

    const records = await airtableBase(tableName)
      .select({
        filterByFormula: \`{\${queryField}} = '\${queryValue}'\`,
        maxRecords: 1,
      })
      .firstPage();

    const record = records[0] ?? null;

    if (record) {
      console.log(\`Updating existing record for \${queryField} = \${queryValue}\`);
      const updatedRecord = await airtableBase(tableName).update([
        { id: record.id, fields: data },
      ]);

      await sendToWebhook(
        {
          sender: 'system:customer_profile_airtable',
          type: 'JSON',
          message: JSON.stringify({ airtableData: updatedRecord }),
          phoneNumber: queryField === 'phone' ? queryValue : '',
        },
        process.env.WEBHOOK_URL
      ).catch((err) => console.error('Failed to send to webhook:', err));

      return {
        success: true,
        data: {
          message: \`Updated record for \${queryField} = \${queryValue}\`,
          content: updatedRecord,
        },
      };
    } else {
      console.log(\`Creating new record for \${queryField} = \${queryValue}\`);
      const newRecord = await airtableBase(tableName).create([
        { fields: { [queryField]: queryValue, ...data } },
      ]);
      return {
        success: true,
        data: {
          message: \`Created new record for \${queryField} = \${queryValue}\`,
          content: newRecord,
        },
      };
    }
  } catch (err) {
    let errorMessage = 'Failed to upsert Airtable record';
    errorMessage =
      err instanceof Error ? err.message : JSON.stringify(err) || errorMessage;

    return {
      success: false,
      error: errorMessage,
    };
  }
}`
    }
  };
  
  for (const toolName of config.toolCalls) {
    if (additionalTools[toolName] && !toolDefinitions[toolName]) {
      const toolDir = path.join(toolsDir, toolName);
      await fs.ensureDir(toolDir);
      
      await fs.writeFile(
        path.join(toolDir, 'manifest.ts'),
        additionalTools[toolName].manifest
      );
      
      await fs.writeFile(
        path.join(toolDir, 'executor.ts'),
        additionalTools[toolName].executor
      );
    }
  }
}

module.exports = { generateTools }; 