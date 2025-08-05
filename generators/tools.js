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

module.exports = { generateTools }; 