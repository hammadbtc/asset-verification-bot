#!/bin/bash

echo "🚀 NFT Verifier Setup"
echo "====================="
echo ""

# Check Node.js version
echo "Checking Node.js..."
node_version=$(node -v 2>/dev/null)
if [ $? -ne 0 ]; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    exit 1
fi
echo "✅ Node.js $node_version"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Create .env if not exists
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your Discord credentials!"
else
    echo "✅ .env already exists"
fi

echo ""
echo "====================="
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your Discord bot credentials"
echo "2. Create a Discord bot at https://discord.com/developers/applications"
echo "3. Enable these intents: Server Members, Message Content"
echo "4. Invite bot to your server with applications.commands scope"
echo "5. Run: npm run dev"
echo ""
