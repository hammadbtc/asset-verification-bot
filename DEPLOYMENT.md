# NFT Verifier - Deployment Guide

## Quick Start (Local Development)

```bash
# 1. Clone and enter directory
cd nft-verifier

# 2. Run setup
./setup.sh

# 3. Configure environment
# Edit .env with your Discord credentials

# 4. Start development server
npm run dev
```

## Discord Bot Setup

1. Go to https://discord.com/developers/applications
2. Click "New Application" → Name it → Create
3. Go to "Bot" tab → "Add Bot" → "Yes, do it!"
4. Enable intents:
   - SERVER MEMBERS INTENT
   - MESSAGE CONTENT INTENT
5. Copy Token (for DISCORD_TOKEN)
6. Go to "OAuth2" → "General" → Copy Client ID (for DISCORD_CLIENT_ID)
7. Go to "OAuth2" → "URL Generator":
   - Select scopes: `bot`, `applications.commands`
   - Bot permissions: `Manage Roles`, `Send Messages`, `Embed Links`
   - Copy the URL and open it to invite bot

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DISCORD_TOKEN | ✅ | Bot token from Discord Developer Portal |
| DISCORD_CLIENT_ID | ✅ | Application ID from Discord Developer Portal |
| DISCORD_GUILD_ID | ⚪ | Test server ID (for faster command registration) |
| VERIFIED_ROLE_ID | ✅ | Role ID to assign verified users |
| WEB_PORT | ⚪ | Web server port (default: 3000) |
| BOT_PORT | ⚪ | Bot API port (default: 3001) |
| WEB_BASE_URL | ⚪ | Public URL for web app |
| HIRO_API_KEY | ⚪ | For higher Hiro API rate limits |

## Finding IDs

### Guild ID (Server ID)
1. Enable Developer Mode in Discord (Settings → Advanced)
2. Right-click server name → Copy Server ID

### Role ID
1. Enable Developer Mode
2. Server Settings → Roles → Right-click role → Copy Role ID

## Production Deployment

### Option 1: Docker Compose (Recommended)

```bash
# 1. Configure .env for production
cp .env.example .env
# Edit .env with production values

# 2. Deploy
docker-compose up -d

# 3. View logs
docker-compose logs -f
```

### Option 2: Manual Node.js

```bash
# 1. Install dependencies
npm ci --only=production

# 2. Set NODE_ENV
export NODE_ENV=production

# 3. Start with PM2 (recommended)
npm install -g pm2
pm2 start web/server.js --name nft-web
pm2 start bot/index.js --name nft-bot
```

### Option 3: Railway/Render/Fly.io

1. Push to GitHub
2. Connect your platform
3. Set environment variables
4. Deploy!

## Architecture

```
Discord User → /verify command
     ↓
Discord Bot creates session
     ↓
User visits web app via link
     ↓
Connects wallet (Unisat/Xverse/Leather)
     ↓
Signs verification message
     ↓
Backend verifies signature
     ↓
Backend checks Hiro API for NFTs
     ↓
Role assigned in Discord
     ↓
Daily re-verification (optional)
```

## Customization

### Adding Collection Filters

Edit `shared/collections.js`:

```javascript
export const COLLECTIONS = {
    'my-collection': {
        name: 'My Collection',
        type: 'ordinals',
        creatorAddress: 'bc1p...',
        minCount: 1
    }
};
```

### Custom Verification Message

Edit the message in `web/public/index.html`:

```javascript
const message = `Custom message for ${userId}`;
```

## Troubleshooting

### Bot not responding to commands
- Check DISCORD_TOKEN is correct
- Ensure bot has applications.commands scope
- Check intents are enabled in Developer Portal

### Web app not accessible
- Check WEB_PORT is not blocked
- Verify WEB_BASE_URL is correct
- For production, use a reverse proxy (nginx)

### Signature verification failing
- Ensure you're in development mode for testing
- For production, implement full BIP322 verification
- Check wallet compatibility

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/session | POST | Create verification session |
| /api/session/:id | GET | Get session status |
| /api/nfts | GET | Get NFTs for address |
| /api/verify | POST | Submit verification |
| /api/result/:id | GET | Get verification result |

## Security Considerations

1. **Never commit .env files**
2. Use HTTPS in production
3. Implement rate limiting
4. Store verification data securely
5. Validate all inputs
6. Use proper CORS configuration

## Support

For issues or questions, check:
- Discord.js docs: https://discord.js.org
- Hiro API docs: https://docs.hiro.so
- sats-connect: https://docs.xverse.app/sats-connect
