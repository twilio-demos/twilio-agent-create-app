# create-twilio-agent

A CLI tool to create Twilio agents with a single command, similar to `create-next-app`.

## Features

- 🚀 **Quick Setup**: Create a working Twilio agent in seconds
- 🛠️ **Customizable Tool Calls**: Choose which tools to include
- 📦 **Package Manager Support**: npm, yarn, or pnpm
- 🔧 **TypeScript Support**: Optional TypeScript configuration
- 📝 **Environment Templates**: Pre-configured .env.example
- 🎯 **Barebones Structure**: Clean, minimal starting point
- 📚 **Comprehensive Documentation**: Auto-generated README

## Installation

```bash
npm install -g create-twilio-agent
```

## Usage

### Basic Usage

```bash
npx create-twilio-agent my-agent
```

### Interactive Mode

```bash
npx create-twilio-agent
```

This will prompt you for:
- Project name
- Tool calls to include
- Package manager preference
- TypeScript support
- Git initialization

### Skip Prompts

```bash
npx create-twilio-agent my-agent --yes
```

Uses all default options:
- Project name: `my-agent`
- Tool calls: web_search, file_reader, code_interpreter
- Package manager: npm
- TypeScript: false
- Git: true

## Available Tool Calls

The generator supports the following tool calls:

- **Web Search** - Search the web for information
- **File Reader** - Read files from the filesystem
- **Code Interpreter** - Execute JavaScript code
- **Database Query** - Query a database
- **API Call** - Make HTTP API calls
- **Email Sender** - Send emails

## Generated Project Structure

```
my-agent/
├── src/
│   ├── index.js          # Main agent file
│   └── tools/            # Tool call implementations
│       ├── webSearch.js
│       ├── fileReader.js
│       ├── codeInterpreter.js
│       ├── databaseQuery.js
│       ├── apiCall.js
│       └── emailSender.js
├── .env.example          # Environment template
├── .gitignore           # Git ignore file
├── package.json         # Dependencies and scripts
└── README.md           # Project documentation
```

## Environment Variables

The generated project includes a `.env.example` file with common environment variables:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here

# Server Configuration
PORT=3000

# Database Configuration (if using database tools)
DATABASE_URL=your_database_url_here

# API Keys (if using external APIs)
GOOGLE_API_KEY=your_google_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Email Configuration (if using email sender)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password_here
```

## Getting Started

1. Create a new agent:
   ```bash
   npx create-twilio-agent my-agent
   ```

2. Navigate to the project:
   ```bash
   cd my-agent
   ```

3. Copy and configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your Twilio credentials
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Start the agent:
   ```bash
   npm start
   ```

The agent will be available at `http://localhost:3000`

## API Endpoints

### POST /agent
Main agent endpoint that processes tool calls and returns results.

**Request Body:**
```json
{
  "message": "User message",
  "tool_calls": [
    {
      "id": "call_123",
      "name": "web_search",
      "arguments": "search query"
    }
  ]
}
```

**Response:**
```json
{
  "tool_results": [
    {
      "tool_call_id": "call_123",
      "output": "Search results..."
    }
  ]
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy"
}
```

## Customization

### Adding New Tool Calls

1. Create a new tool file in `src/tools/`
2. Export a function that handles the tool call
3. Add the tool to the `toolHandlers` object in `src/index.js`

Example:
```javascript
// src/tools/customTool.js
module.exports = async (args) => {
  // Your tool implementation
  return { result: 'success' };
};
```

### Environment Variables

Add new environment variables to `.env.example` and access them in your code:

```javascript
const customValue = process.env.CUSTOM_VARIABLE;
```

## Development

To contribute to this package:

1. Clone the repository
2. Install dependencies: `npm install`
3. Make your changes
4. Test locally: `node index.js test-project`
5. Submit a pull request

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.