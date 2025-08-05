const fs = require('fs-extra');
const path = require('path');

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
  const typesTemplate = `import { EventEmitter } from 'node:events';

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
  on<K extends keyof T>(event: K, listener: T[K] extends (...args: any[]) => any ? T[K] : never): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this;
  on(event: any, listener: any): this {
    return super.on(event, listener);
  }

  emit<K extends keyof T>(event: K, ...args: T[K] extends (...args: infer P) => any ? P : never[]): boolean;
  emit(event: string | symbol, ...args: any[]): boolean;
  emit(event: any, ...args: any[]): boolean {
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
  const languagesTemplate = `export type Language = {
  value: string;
  label: string;
  systemMessages: {
    assistant: string;
    languageSwitch: string;
    critical: string;
  };
  twilioConfig: {
    ttsProvider: string;
    voice: string | undefined;
    transcriptionProvider: string;
    speechModel: string;
  };
};

export const languages: Language[] = [
  {
    value: 'en-US',
    label: 'English (US)',
    systemMessages: {
      assistant:
        'You are a helpful AI assistant. Keep responses concise and natural for voice conversation.',
      languageSwitch:
        'IMPORTANT: If a user asks you to switch languages (e.g. "speak Spanish", "switch to English", "habla español", "sprechen Sie Deutsch", "fale português", "parlez français", "日本語で話してください", "हिंदी में बोलें", "spreek Nederlands", "parla italiano", "说中文"), you must use the switchLanguage tool to change both TTS and transcription languages.',
      critical:
        'CRITICAL: NEVER switch languages manually. You MUST call the switchLanguage tool BEFORE responding in a different language. You can switch to: English (en-US), Spanish (es-ES), German (de-DE), Portuguese (pt-BR), French (fr-FR), Japanese (ja-JP), Hindi (hi-IN), Dutch (nl-NL), Italian (it-IT), or Chinese (zh-CN).',
    },
    twilioConfig: {
      ttsProvider: 'ElevenLabs',
      voice: 'g6xIsTj2HwM6VR4iXFCw',
      transcriptionProvider: 'Deepgram',
      speechModel: 'nova-3-general',
    },
  },
  {
    value: 'es-ES',
    label: 'Spanish (Spain)',
    systemMessages: {
      assistant:
        'You are a helpful AI assistant. Keep responses concise and natural for voice conversation. Respond in Spanish.',
      languageSwitch:
        'IMPORTANTE: Si el usuario te pide cambiar de idioma (ej. "habla inglés", "switch to English", "speak English", "sprechen Sie Deutsch", "fale português", "parlez français", "日本語で話してください", "हिंदी में बोलें", "spreek Nederlands", "parla italiano"), debes usar la herramienta switchLanguage para cambiar tanto TTS como transcripción.',
      critical:
        'CRÍTICO: NUNCA cambies idiomas manualmente. DEBES llamar la herramienta switchLanguage ANTES de responder en un idioma diferente. NO respondas en inglés a menos que hayas llamado primero switchLanguage con ttsLanguage="en-US" y transcriptionLanguage="en-US". Puedes cambiar a: Inglés (en-US), Español (es-ES), Alemán (de-DE), Portugués (pt-BR), Francés (fr-FR), Japonés (ja-JP), Hindi (hi-IN), Neerlandés (nl-NL), o Italiano (it-IT).',
    },
    twilioConfig: {
      ttsProvider: 'ElevenLabs',
      voice: 'g6xIsTj2HwM6VR4iXFCw',
      transcriptionProvider: 'Google',
      speechModel: 'long',
    },
  },
  {
    value: 'de-DE',
    label: 'German (Germany)',
    systemMessages: {
      assistant:
        'You are a helpful AI assistant. Keep responses concise and natural for voice conversation. Respond in German.',
      languageSwitch:
        'WICHTIG: Wenn der Benutzer Sie bittet, die Sprache zu wechseln (z.B. "sprechen Sie Englisch", "switch to English", "speak English", "habla español", "fale português", "parlez français", "日本語で話してください", "हिंदी में बोलें", "spreek Nederlands", "parla italiano"), müssen Sie das switchLanguage-Tool verwenden, um sowohl TTS- als auch Transkriptionssprachen zu ändern.',
      critical:
        'KRITISCH: Wechseln Sie NIEMALS manuell die Sprache. Sie MÜSSEN das switchLanguage-Tool aufrufen, BEVOR Sie in einer anderen Sprache antworten. Antworten Sie NICHT auf Englisch, es sei denn, Sie haben zuerst switchLanguage mit ttsLanguage="en-US" und transcriptionLanguage="en-US" aufgerufen. Sie können wechseln zu: Englisch (en-US), Spanisch (es-ES), Deutsch (de-DE), Portugiesisch (pt-BR), Französisch (fr-FR), Japanisch (ja-JP), Hindi (hi-IN), Niederländisch (nl-NL), oder Italienisch (it-IT).',
    },
    twilioConfig: {
      ttsProvider: 'ElevenLabs',
      voice: 'g6xIsTj2HwM6VR4iXFCw',
      transcriptionProvider: 'Google',
      speechModel: 'long',
    },
  },
  {
    value: 'pt-BR',
    label: 'Portuguese (Brazil)',
    systemMessages: {
      assistant:
        'You are a helpful AI assistant. Keep responses concise and natural for voice conversation. Respond in Portuguese.',
      languageSwitch:
        'IMPORTANTE: Se o usuário pedir para mudar de idioma (ex. "fale inglês", "switch to English", "speak English", "habla español", "sprechen Sie Deutsch", "parlez français", "日本語で話してください", "हिंदी में बोलें", "spreek Nederlands", "parla italiano"), você deve usar a ferramenta switchLanguage para alterar tanto TTS quanto idiomas de transcrição.',
      critical:
        'CRÍTICO: NUNCA mude idiomas manualmente. Você DEVE chamar a ferramenta switchLanguage ANTES de responder em um idioma diferente. NÃO responda em inglês a menos que você tenha chamado primeiro switchLanguage com ttsLanguage="en-US" e transcriptionLanguage="en-US". Você pode mudar para: Inglês (en-US), Espanhol (es-ES), Alemão (de-DE), Português (pt-BR), Francés (fr-FR), Japonês (ja-JP), Hindi (hi-IN), Holandês (nl-NL), ou Italiano (it-IT).',
    },
    twilioConfig: {
      ttsProvider: 'ElevenLabs',
      voice: 'g6xIsTj2HwM6VR4iXFCw',
      transcriptionProvider: 'Google',
      speechModel: 'long',
    },
  },
  {
    value: 'fr-FR',
    label: 'French (France)',
    systemMessages: {
      assistant:
        'You are a helpful AI assistant. Keep responses concise and natural for voice conversation. Respond in French.',
      languageSwitch:
        'IMPORTANT: Si l\\'utilisateur vous demande de changer de langue (ex. "parlez anglais", "switch to English", "speak English", "habla español", "sprechen Sie Deutsch", "fale português", "日本語で話してください", "हिंदी में बोलें", "spreek Nederlands", "parla italiano"), vous devez utiliser l\\'outil switchLanguage pour changer à la fois TTS et transcription.',
      critical:
        'CRITIQUE: Ne changez JAMAIS de langue manuellement. Vous DEVEZ appeler l\\'outil switchLanguage AVANT de répondre dans une langue différente. NE répondez PAS en anglais sauf si vous avez d\\'abord appelé switchLanguage avec ttsLanguage="en-US" et transcriptionLanguage="en-US". Vous pouvez changer vers: Anglais (en-US), Espagnol (es-ES), Allemand (de-DE), Portugais (pt-BR), Français (fr-FR), Japonais (ja-JP), Hindi (hi-IN), Néerlandais (nl-NL), ou Italien (it-IT).',
    },
    twilioConfig: {
      ttsProvider: 'ElevenLabs',
      voice: 'g6xIsTj2HwM6VR4iXFCw',
      transcriptionProvider: 'Google',
      speechModel: 'long',
    },
  },
  {
    value: 'ja-JP',
    label: 'Japanese',
    systemMessages: {
      assistant:
        'You are a helpful AI assistant. Keep responses concise and natural for voice conversation. Respond in Japanese.',
      languageSwitch:
        '重要: ユーザーが言語の変更を要求した場合（例：「英語を話してください」、「switch to English」、「speak English」、「habla español」、「sprechen Sie Deutsch」、「fale português」、「parlez français」、「हिंदी में बोलें」、「spreek Nederlands」、「parla italiano」）、TTSとトランスクリプションの両方を変更するためにswitchLanguageツールを使用する必要があります。',
      critical:
        '重要: 決して手動で言語を変更しないでください。異なる言語で応答する前に、必ずswitchLanguageツールを呼び出す必要があります。ttsLanguage="en-US"とtranscriptionLanguage="en-US"でswitchLanguageを最初に呼び出していない限り、英語で応答しないでください。次の言語に変更できます：英語 (en-US)、スペイン語 (es-ES)、ドイツ語 (de-DE)、ポルトガル語 (pt-BR)、フランス語 (fr-FR)、日本語 (ja-JP)、ヒンディー語 (hi-IN)、オランダ語 (nl-NL)、イタリア語 (it-IT)。',
    },
    twilioConfig: {
      ttsProvider: 'ElevenLabs',
      voice: 'g6xIsTj2HwM6VR4iXFCw',
      transcriptionProvider: 'Google',
      speechModel: 'long',
    },
  },
  {
    value: 'hi-IN',
    label: 'Hindi',
    systemMessages: {
      assistant:
        'You are a helpful AI assistant. Keep responses concise and natural for voice conversation. Respond in Hindi.',
      languageSwitch:
        'महत्वपूर्ण: यदि उपयोगकर्ता भाषा बदलने के लिए कहता है (जैसे "अंग्रेजी बोलें", "switch to English", "speak English", "habla español", "sprechen Sie Deutsch", "fale português", "parlez français", "日本語で話してください", "spreek Nederlands", "parla italiano"), तो आपको TTS और ट्रांसक्रिप्शन दोनों भाषाओं को बदलने के लिए switchLanguage टूल का उपयोग करना होगा।',
      critical:
        'महत्वपूर्ण: कभी भी मैन्युअल रूप से भाषा न बदलें। किसी अलग भाषा में जवाब देने से पहले आपको switchLanguage टूल को कॉल करना होगा।जब तक आप पहले ttsLanguage="en-US" और transcriptionLanguage="en-US" के साथ switchLanguage को कॉल नहीं करते, तब तक अंग्रेजी में जवाब न दें। आप इन भाषाओं में बदल सकते हैं: अंग्रेजी (en-US), स्पेनिश (es-ES), जर्मन (de-DE), पुर्तगाली (pt-BR), फ्रेंच (fr-FR), जापानी (ja-JP), हिंदी (hi-IN), डच (nl-NL), या इटालियन (it-IT)।',
    },
    twilioConfig: {
      ttsProvider: 'ElevenLabs',
      voice: 'g6xIsTj2HwM6VR4iXFCw',
      transcriptionProvider: 'Google',
      speechModel: 'long',
    },
  },
  {
    value: 'nl-NL',
    label: 'Dutch',
    systemMessages: {
      assistant:
        'You are a helpful AI assistant. Keep responses concise and natural for voice conversation. Respond in Dutch.',
      languageSwitch:
        'BELANGRIJK: Als de gebruiker vraagt om van taal te wisselen (bijv. "spreek Engels", "switch to English", "speak English", "habla español", "sprechen Sie Deutsch", "fale português", "parlez français", "日本語で話してください", "हिंदी में बोलें", "parla italiano"), moet je de switchLanguage-tool gebruiken om zowel TTS als transcriptietaal te wijzigen.',
      critical:
        'KRITIEK: Wissel NOOIT handmatig van taal. Je MOET de switchLanguage-tool aanroepen VOORDAT je in een andere taal reageert. Reageer NIET in het Engels tenzij je eerst switchLanguage hebt aangeroepen met ttsLanguage="en-US" en transcriptionLanguage="en-US". Je kunt wisselen naar: Engels (en-US), Spaans (es-ES), Duits (de-DE), Portugees (pt-BR), Frans (fr-FR), Japans (ja-JP), Hindi (hi-IN), Nederlands (nl-NL), of Italiaans (it-IT).',
    },
    twilioConfig: {
      ttsProvider: 'ElevenLabs',
      voice: 'g6xIsTj2HwM6VR4iXFCw',
      transcriptionProvider: 'Google',
      speechModel: 'long',
    },
  },
  {
    value: 'it-IT',
    label: 'Italian',
    systemMessages: {
      assistant:
        'You are a helpful AI assistant. Keep responses concise and natural for voice conversation. Respond in Italian.',
      languageSwitch:
        'IMPORTANTE: Se l\\'utente chiede di cambiare lingua (es. "parla inglese", "switch to English", "speak English", "habla español", "sprechen Sie Deutsch", "fale português", "parlez français", "日本語で話してください", "हिंदी में बोलें", "spreek Nederlands", "parla italiano"), devi usare lo strumento switchLanguage per cambiare sia la lingua TTS che quella di trascrizione.',
      critical:
        'CRITICO: NON cambiare mai lingua manualmente. DEVI chiamare lo strumento switchLanguage PRIMA di rispondere in una lingua diversa. NON rispondere in inglese a meno che tu non abbia prima chiamato switchLanguage con ttsLanguage="en-US" e transcriptionLanguage="en-US". Puoi cambiare in: Inglese (en-US), Spagnolo (es-ES), Tedesco (de-DE), Portoghese (pt-BR), Francese (fr-FR), Giapponese (ja-JP), Hindi (hi-IN), Olandese (nl-NL), o Italiano (it-IT).',
    },
    twilioConfig: {
      ttsProvider: 'ElevenLabs',
      voice: 'g6xIsTj2HwM6VR4iXFCw',
      transcriptionProvider: 'Deepgram',
      speechModel: 'nova-2-general',
    },
  },
  {
    value: 'zh-CN',
    label: 'Chinese (Mandarin)',
    systemMessages: {
      assistant:
        'You are a helpful AI assistant. Keep responses concise and natural for voice conversation. Respond in Mandarin Chinese.',
      languageSwitch:
        '重要：如果用户要求切换语言（例如"说英语"、"switch to English"、"speak English"、"habla español"、"sprechen Sie Deutsch"、"fale português"、"parlez français"、"日本語で話してください"、"हिंदी में बोलें"、"spreek Nederlands"、"parla italiano"），您必须使用switchLanguage工具来更改TTS和转录语言。',
      critical:
        '重要：切勿手动切换语言。在回复不同语言之前，您必须先调用switchLanguage工具。除非您首先使用ttsLanguage="en-US"和transcriptionLanguage="en-US"调用switchLanguage，否则不要用英语回复。您可以切换到：英语 (en-US)、西班牙语 (es-ES)、德语 (de-DE)、葡萄牙语 (pt-BR)、法语 (fr-FR)、日语 (ja-JP)、印地语 (hi-IN)、荷兰语 (nl-NL)、意大利语 (it-IT)、或中文 (zh-CN)。',
    },
    twilioConfig: {
      ttsProvider: 'ElevenLabs',
      voice: 'g6xIsTj2HwM6VR4iXFCw',
      transcriptionProvider: 'Deepgram',
      speechModel: 'nova-2-general',
    },
  },
];

// Language code mappings for Twilio (used in switchLanguage tool)
export const LANGUAGE_CODE_MAP: Record<string, string> = {
  en: 'en-US',
  'en-US': 'en-US',
  es: 'es-ES',
  'es-ES': 'es-ES',
  'es-MX': 'es-MX',
  de: 'de-DE',
  'de-DE': 'de-DE',
  pt: 'pt-BR',
  'pt-BR': 'pt-BR',
  fr: 'fr-FR',
  'fr-FR': 'fr-FR',
  ja: 'ja-JP',
  'ja-JP': 'ja-JP',
  hi: 'hi-IN',
  'hi-IN': 'hi-IN',
  nl: 'nl-NL',
  'nl-NL': 'nl-NL',
  it: 'it-IT',
  'it-IT': 'it-IT',
  zh: 'zh-CN',
  'zh-CN': 'zh-CN',
};

// Helper function to get language label by value
export function getLanguageLabel(value: string): string {
  const language = languages.find((lang) => lang.value === value);
  return language?.label || value;
}

// Helper function to check if a language is supported
export function isLanguageSupported(value: string): boolean {
  return languages.some((lang) => lang.value === value);
}

// Helper function to get system messages for a language
export function getLanguageSystemMessages(value: string) {
  const language = languages.find((lang) => lang.value === value);
  return language?.systemMessages || languages[0].systemMessages; // fallback to English
}

// Helper function to get Twilio configuration for a language
export function getLanguageTwilioConfig(value: string) {
  const language = languages.find((lang) => lang.value === value);
  return language?.twilioConfig || languages[0].twilioConfig; // fallback to English
}
`;

  await fs.writeFile(path.join(libDir, 'config', 'languages.ts'), languagesTemplate);
  
  // Generate instructions.md
  const instructionsTemplate = `# Agent Instructions

You are a helpful voice agent for Twilio ConversationRelay. Your role is to assist customers with their inquiries in a professional and efficient manner.

## Key Guidelines

1. **Always greet first**: Begin every conversation with a warm, professional greeting
2. **Be conversational**: Since this is a voice interaction, speak naturally and keep responses concise
3. **Be helpful**: Always try to assist the customer with their needs
4. **Use tools**: You have access to various tools to provide better service - use them when appropriate
5. **Stay professional**: Maintain a friendly but professional tone
6. **Transfer when needed**: If you cannot help, transfer to a live agent using the sendToLiveAgent tool
7. **Language**: Always speak in English unless the customer explicitly requests a different language

## Available Capabilities (DO NOT USE THESE UNLESS ASKED TO)

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

module.exports = { generateLibStructure }; 