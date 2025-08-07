# create-twilio-agent


## How to run



## 📋 Prerequisites

- Node.js 18+ 
- Twilio Account


## 🛠️ Setup

## 1. Generate Your Agent

```bash
# Initialize the repo
npx create-twilio-agent
```

## 2. Configure Environment Variables

```bash
# Navigate to your generated agent
 cd <project name>

# Rename the template to .env:
cp .env.example .env
```


## 3. Fill In Your Environment Variables:

### Setup Ngrok

Create a static domain here: https://ngrok.com/blog-post/free-static-domains-ngrok-users#reserve-your-static-domain

Copy your domain url

Run `ngrok http 3000 --domain <your static url>.ngrok-free.app` replacing `<your static url>` with your own, leave that terminal running on the side. If it worked, you should see something like this:

<img width="588" height="373" alt="Screenshot 2025-08-06 at 9 40 07 PM" src="https://github.com/user-attachments/assets/daaff362-5908-448d-9b6b-e715de8c91be" />




Go to https://console.twilio.com/us1/develop/phone-numbers/manage/incoming and purchase a number if you do not have one already

Find your active number, and select it

<img width="454" height="145" alt="image" src="https://github.com/user-attachments/assets/d1d886c6-0a8f-4fe4-9544-ca72e36ce9b5" />


Replace your "A call comes in" webhook like so:

`https://` + your ngrok webhook + `/call`

Make it a `GET` call, NOT `POST`

<img width="625" height="259" alt="Screenshot 2025-08-06 at 6 41 52 PM" src="https://github.com/user-attachments/assets/c0bd144b-81cd-4ab7-8a86-b31476b16b5b" />


### Twilio Configuration

Go to
   https://console.twilio.com/
 
   Find `Account SID` and `Auth Token`

   ```env
   TWILIO_ACCOUNT_SID=your_account_sid

   TWILIO_AUTH_TOKEN=your_auth_token
   ```
 

Next, we need to fill in the .env with our OpenAI API token. To generate an OpenAPI API KEY. Go to https://platform.openai.com/api-keys -> login -> hit `+ Create new secret key` and copy the api key into your `.env` file

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4.1
```
   


##  Features

- **Voice AI Agent**: Powered by OpenAI GPT models
- **Twilio Integration**: Full ConversationRelay support
- **Multi-language Support**: 10+ languages with TTS/STT
- **Tool System**: Extensible tool framework
- **RCS Messaging**: Rich Communication Services support
- **Live Agent Handoff**: Seamless transfer to human agents
- **Webhook Support**: Real-time event notifications



### Available Tools

- `getSegmentProfile` - Get customer profile data from Segment
- `getSegmentEvents` - Retrieve customer event history from Segment
- `postSegmentTrack` - Track customer events in Segment
- `updateSegmentProfile` - Update customer profile in Segment
- `getAirtableData` - Retrieve data from Airtable
- `upsertAirtableData` - Insert or update data in Airtable
- `sendText` - Send SMS messages
- `sendRCS` - Send Rich Communication Services messages
- `sendToLiveAgent` - Transfer to human agent
- `sendEmail` - Send emails via SendGrid
- `switchLanguage` - Change conversation language

### Customization

Edit these files to customize your agent:

- `src/lib/prompts/instructions.md` - Agent behavior and personality
- `src/lib/prompts/context.md` - Business context and domain knowledge
- `src/tools/` - Add custom tools

