#!/bin/bash

echo "🧹 Cleaning up existing test-agent..."
rm -rf test-agent

echo "🚀 Creating new test-agent..."
node index.js test-agent --yes

echo "📦 Installing dependencies..."
cd test-agent && npm install

echo "📋 Copying .env file..."
cp ../.env . && rm -f .env.example

echo "✅ Reset complete! New test-agent is ready."
echo "Next steps:"
echo "  cd test-agent"
echo "  npm run dev" 