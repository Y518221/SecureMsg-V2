# Gemini API Bot Integration

## Changes Made

Your SecureMsg bot has been upgraded to use **Google Gemini AI API** instead of the local rule-based system.

### What Changed

1. **botService.ts** - Completely rewritten to use Gemini API
   - Uses `@google/genai` SDK (already in package.json)
   - Calls `gemini-1.5-flash` model for fast, efficient responses
   - Uses `bot-knowledge.json` as system context to keep bot focused on SecureMsg
   - Maintains safety checks (blocked request filtering)

2. **messageController.ts** - Updated to handle async bot replies
   - Changed `botService.reply(text)` to `await botService.reply(text)`
   - Added error logging

### How It Works

When a user chats with the bot:

1. Frontend sends message to `/api/messages/bot-reply`
2. messageController receives it and calls `botService.reply(message)`
3. botService builds a system prompt from `bot-knowledge.json`
4. Makes API call to Gemini with the user's message
5. Returns AI-generated response focused on SecureMsg support

### Configuration

**Required:**
- `GEMINI_API_KEY` - Already in your `.env`

**Optional Settings:**
- Model: `gemini-1.5-flash` (fast, cheap)
- Temperature: `0.7` (balanced creativity)
- Max tokens: `500` (keeps responses concise)

### Benefits

✅ **Smarter responses** - Uses AI instead of hardcoded rules
✅ **Faster** - Uses gemini-1.5-flash (cheaper, quicker than 1.5-pro)
✅ **Focused** - System prompt ensures bot stays on topic
✅ **Safe** - Still blocks sensitive requests before calling API
✅ **Maintains context** - bot-knowledge.json provides domain knowledge

### Testing Locally

```bash
# Make sure .env has GEMINI_API_KEY set
npm run dev

# Test bot in frontend, or use curl:
curl -X POST http://localhost:3000/api/messages/bot-reply \
  -H "Content-Type: application/json" \
  -d '{"message":"How do I encrypt a message?"}'
```

### Deployment

1. Push code:
```bash
git add server/services/botService.ts server/controllers/messageController.ts
git commit -m "Upgrade bot to use Gemini AI API"
git push
```

2. Render environment already has `GEMINI_API_KEY` set from `.env`

3. No changes needed to build/start commands

4. Restart the service on Render to pull new code

### What Stayed the Same

- Bot is still integrated into messages (same `/api/messages/bot-reply` endpoint)
- `bot-knowledge.json` still used as context
- Frontend doesn't need any changes
- All security checks maintained

### If Something Goes Wrong

1. Check Render logs for "GEMINI_API_KEY not set"
2. Verify API key in `.env` on Render dashboard
3. Check API quota on https://aistudio.google.com
4. Bot will gracefully fall back with user-friendly error message

### Cost

Gemini API is very affordable:
- ~$0.075 per 1M input tokens
- ~$0.30 per 1M output tokens
- Most of your messages will be < 500 tokens

With 500-1000 daily bot messages, expect ~$0.01-0.05/month in API costs.
