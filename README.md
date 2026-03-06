# Asset Verification Bot

Lightweight Bitcoin NFT ownership verification for Discord. Message signing only — no PSBT, no trading features, just verification.

## Architecture

```
Discord User → /verify command
     ↓
Bot creates session + link
     ↓
User connects wallet (Unisat/Xverse/Leather)
     ↓
Signs message (not PSBT - safe)
     ↓
Backend checks Hiro API for NFTs
     ↓
Role assigned in Discord
```

## Features

- ✅ **Unisat** wallet support
- ✅ **Xverse** wallet support  
- ✅ **Leather** wallet support
- ✅ Message signing only (safe, no funds at risk)
- ✅ Hiro API integration for Ordinals
- ✅ Discord role management
- ✅ Daily re-verification

## No Heavy Dependencies

Unlike sats-connect (50KB+), this uses direct wallet injection:
- `window.unisat` for Unisat
- `window.bitcoin.xverse` for Xverse
- `window.StacksProvider` for Leather

## Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your Discord credentials
```

3. **Start:**
```bash
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DISCORD_TOKEN | ✅ | Bot token |
| DISCORD_CLIENT_ID | ✅ | Application ID |
| DISCORD_GUILD_ID | ⚪ | Test server ID |
| VERIFIED_ROLE_ID | ✅ | Role to assign |
| WEB_PORT | ⚪ | Default 3000 |
| BOT_PORT | ⚪ | Default 3001 |

## Discord Bot Setup

1. Go to https://discord.com/developers/applications
2. Create New Application → Bot tab → Add Bot
3. Enable intents: SERVER MEMBERS, MESSAGE CONTENT
4. Copy token for DISCORD_TOKEN
5. OAuth2 → URL Generator:
   - Scopes: `bot`, `applications.commands`
   - Permissions: `Manage Roles`, `Send Messages`
   - Copy URL to invite bot

## Deployment (Railway)

1. Push code to GitHub
2. Connect Railway to repo
3. Add environment variables
4. Deploy

No custom domain needed — Railway gives you a free subdomain.

## Security

- Message signing only (proves ownership without exposing funds)
- No PSBT handling
- No transaction signing
- Verification via Hiro API (trusted Ordinals indexer)

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/session | POST | Create verification session |
| /api/session/:id | GET | Check session status |
| /api/nfts | GET | Get NFTs for address |
| /api/verify | POST | Submit verification |

## License

MIT
