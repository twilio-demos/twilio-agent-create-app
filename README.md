# create-twilio-agent

Create a new Twilio agent with a single command.

## Quick Start

```bash
npx create-twilio-agent my-agent
```

This will create a new Twilio agent project in the `my-agent` directory.

## Usage

### Interactive Mode (Default)

```bash
npx create-twilio-agent
```

This will prompt you for:
- Project name
- Voice agent tools to include
- Package manager preference (npm, yarn, pnpm)
- Git repository initialization

### Non-Interactive Mode

```bash
npx create-twilio-agent my-agent --yes
```

This creates a project with default settings:
- Project name: `my-agent`
- Includes common tools (sendText, sendRCS, getSegmentProfile, etc.)
- Uses npm as package manager
- Initializes git repository

## What Gets Created

The generated project includes:

### Core Files
- `app.ts` - Main application file
- `llm.ts` - Language model configuration
- `voices.ts` - Voice configuration

### Library Structure
- `lib/` - Core library files
- `lib/types.ts` - TypeScript type definitions
- `lib/utils.ts` - Utility functions

### Routes
- `routes/` - API route handlers
- `routes/webhook.ts` - Twilio webhook handler

### Tools
- `tools/` - Voice agent tools
- Individual tool files based on your selection

### Configuration
- `package.json` - Project dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `Procfile` - Heroku deployment configuration
- `.env.example` - Environment variables template
- `.gitignore` - Git ignore file

## Available Tools

The generator can include these voice agent tools:

- **Send Text Message** (`sendText`) - Send SMS messages
- **Send RCS Message** (`sendRCS`) - Send Rich Communication Services messages
- **Send Email** (`sendEmail`) - Send email messages
- **Get Customer Profile** (`getSegmentProfile`) - Retrieve customer data from Segment
- **Get Customer Events** (`getSegmentEvents`) - Get customer event history
- **Update Customer Profile** (`updateSegmentProfile`) - Update customer profile data
- **Track Customer Event** (`postSegmentTrack`) - Track customer events
- **Get Customer Data** (`getAirtableData`) - Retrieve data from Airtable
- **Update Customer Data** (`upsertAirtableData`) - Update Airtable records
- **Send to Live Agent** (`sendToLiveAgent`) - Transfer to human agent
- **Switch Language** (`switchLanguage`) - Change conversation language

## Getting Started

After creating your project:

```bash
cd my-agent
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

## Environment Configuration

Edit the `.env` file with your configuration:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# Segment Configuration (if using customer tools)
SEGMENT_WRITE_KEY=your_segment_write_key

# Airtable Configuration (if using Airtable tools)
AIRTABLE_API_KEY=your_airtable_api_key
AIRTABLE_BASE_ID=your_airtable_base_id

# Other Configuration
NODE_ENV=development
PORT=3000
```

## Development

To run the project locally:

```bash
npm run dev
```

This will start the development server on port 3000.

## Deployment

The generated project includes a `Procfile` for easy deployment to Heroku:

```bash
git push heroku main
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT

## Support

For support, please open an issue on GitHub or contact the maintainers.