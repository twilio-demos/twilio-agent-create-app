# create-twilio-agent

## Quick Start

```bash
npx create-twilio-agent my-agent
```

This will create a new Twilio agent project in the `my-agent` directory.

## Architecture
<img width="693" height="534" alt="Screenshot 2025-08-08 at 12 16 10 PM" src="https://github.com/user-attachments/assets/0232ade0-e6ca-4b5f-8020-508d86d4e8ce" />


## Prerequisites

- Node.js 18+
- Twilio Account with a phone number
- OpenAI API key
- [ngrok](https://ngrok.com) with a static domain (free tier works)


## Setup

### 1. Generate your agent

```bash
npx create-twilio-agent my-agent
cd my-agent
cp .env.example .env
```

### 2. Set up ngrok

Create a free static domain at https://ngrok.com/blog-post/free-static-domains-ngrok-users and run:

```bash
ngrok http 3000 --domain <your-static-domain>.ngrok-free.app
```

Leave this terminal running. Copy the domain (without `https://`) into your `.env`:

```env
NGROK_URL=your-static-domain.ngrok-free.app
```

### 3. Fill in required environment variables

Open `.env` and fill in the following. All other variables are optional.

#### Twilio core
Find these at https://console.twilio.com under **Account Info**.

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
```

#### Twilio API Key
Go to https://console.twilio.com/us1/account/keys-credentials/api-keys and create a new Standard API Key.

```env
TWILIO_API_KEY=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_SECRET=your_api_secret
```

> **Note:** The secret is only shown once at creation time. `TWILIO_API_SECRET` is the correct variable name — older versions of this project used `TWILIO_API_TOKEN`, which no longer works.

#### Twilio Conversation Configuration ID
Required for SMS and for TAC to initialize. Create a Conversation Configuration in the Twilio Console under **Conversation Orchestrator** and paste the ID here.

```env
TWILIO_CONVERSATION_CONFIGURATION_ID=conv_configuration_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### OpenAI
Get your key at https://platform.openai.com/api-keys.

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1
```

### 4. Point your Twilio number at the agent

Go to https://console.twilio.com/us1/develop/phone-numbers/manage/incoming, select your number, and set **A call comes in** to:

```
https://<your-ngrok-domain>/call   (GET)
```

### 5. Run the agent

```bash
npm run dev
```

Call your Twilio number — the agent will answer immediately.

---

## Customization

Edit these files to customize your agent's behavior:

| File | Purpose |
|------|---------|
| `src/lib/prompts/instructions.md` | Agent personality and behavior |
| `src/lib/prompts/context.md` | Business context and knowledge |
| `src/tools/` | Add custom tools |

---

## Available tools

| Tool | Description |
|------|-------------|
| `sendText` | Send SMS messages |
| `sendRCS` | Send Rich Communication Services messages |
| `sendToLiveAgent` | Transfer to a human agent |
| `sendEmail` | Send emails via SendGrid |
| `switchLanguage` | Change conversation language |
| `getSegmentProfile` | Get customer profile from Segment |
| `getSegmentEvents` | Retrieve customer event history from Segment |
| `postSegmentTrack` | Track customer events in Segment |
| `updateSegmentProfile` | Update customer profile in Segment |
| `getAirtableData` | Retrieve data from Airtable |
| `upsertAirtableData` | Insert or update data in Airtable |

---

## Features

- Voice AI agent powered by OpenAI GPT models
- Twilio ConversationRelay with agent-speaks-first behavior
- Multi-language support (10+ languages, TTS + STT)
- Extensible tool framework
- Live agent handoff
- SMS channel support via Twilio Conversation Orchestrator
- Real-time webhook event notifications
