# SecureMsg

SecureMsg is a full-stack encrypted messaging app with:
- direct user-to-user chat
- group chat
- encrypted text and file messages
- in-memory session unlock model
- unread badge counts for direct chats
- a built-in rule-based Support Bot (no Gemini API required)

The app uses React + Vite on the frontend and Express + Supabase on the backend.

Live project: https://securemsg-34jy.onrender.com/

---

## 1. Core Features

### Messaging
- Direct chat between two users
- Group chat with owner/member access rules
- Realtime updates with polling fallback
- Message delete (sender-only)

### Encryption Model
- Client-side encryption with `AES-256-GCM`
- Key derivation with `PBKDF2` + `SHA-256`
- Per-message random salt
- Session password is not stored server-side
- Session keys/password are kept in memory in frontend state

### Authentication
- Supabase auth token-based sessions
- Backend validates bearer token for protected routes
- Anonymous secure IDs are used for searching users

### Support Bot
- One seeded bot account (`SECURE-BOT-999`)
- Backend intent-based response generator
- No external LLM/API required

---

## 2. Project Structure

```text
src/
  App.tsx
  main.tsx
  index.css
  components/
  hooks/
  lib/
  services/

server/
  controllers/
  routes/
  services/
  middleware/
  lib/

server.ts
supabase.sql
tsconfig.json
tsconfig.server.json
vite.config.ts
```

---

## 3. Tech Stack

- Frontend: `React 19`, `Vite`, `TypeScript`, `TailwindCSS`, `motion`, `lucide-react`
- Backend: `Express`, `TypeScript`, `tsx`
- Database/Auth/Realtime: `Supabase`
- Crypto:
  - client: Web Crypto API
  - server field encryption helper for usernames

---

## 4. Environment Variables

Create `.env` in project root.

Required:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `MASTER_ENCRYPTION_KEY` (32-byte hex for server-side username encryption)

Optional:
- `GEMINI_API_KEY` (currently not required by Support Bot flow)

Notes:
- `SUPABASE_SERVICE_ROLE_KEY` must be the real service role key, not anon key.
- Wrong key mapping can cause `42501` RLS insert errors.

---

## 5. Install and Run

```bash
npm install
npm run dev
```

Default app server runs on:
- `http://localhost:3000`

Other scripts:
- `npm run lint` -> `tsc --noEmit`
- `npm run build`
- `npm run preview`

---

## 6. Database Setup

Use `supabase.sql` to create schema, indexes, and secure RLS policies.

Important tables:
- `users`
- `groups`
- `group_members`
- `messages`
- `files` (exists for future or extended usage)

### Message data model
- direct message: `group_id = null`, `receiver_id != null`
- group message: `group_id != null`, `receiver_id = null`

---

## 7. RLS and Access Rules

High-level policy behavior:
- Users can read only their own `users` row.
- Groups are readable by owner or members.
- Group membership rows are readable by self or group owner.
- Direct messages are readable only by sender/receiver.
- Group messages are readable only by group owner/member.
- Insert into `messages` requires:
  - `sender_id = auth.uid()`
  - valid direct or group shape
  - group inserts only for owner/member
- Delete message allowed only for original sender.

Realtime publication includes:
- `messages`
- `groups`
- `group_members`

---

## 8. API Summary

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/auth/search/:secureId`
- `GET /api/auth/conversations`
- `DELETE /api/auth/me`

### Messages
- `POST /api/messages/send`
- `GET /api/messages/:otherId`
- `DELETE /api/messages/:messageId`
- `POST /api/messages/bot-reply`

### Groups
- `POST /api/groups/create`
- `POST /api/groups/join/:groupId`
- `GET /api/groups`
- `GET /api/groups/:groupId/messages`
- `DELETE /api/groups/:groupId`

---

## 9. Frontend Behavior Notes

### App shell (`src/App.tsx`)
- Controls views (`home`, `about`, `login`, `register`, `chat`)
- Manages active chat/group
- Holds in-memory:
  - session keys by chat ID
  - chat passwords by chat ID
  - unread badge counts
- Syncs groups and conversations
- Uses Supabase realtime for:
  - group removal sync
  - incoming direct-message unread counting

### Chat window (`src/components/ChatWindow.tsx`)
- Fetches chat history and auto-refreshes
- Merges server messages with local temporary bot messages
- Session unlock gate before message decrypt/send
- Supports file encryption upload and file download
- Supports sender-side delete with server re-sync after delete

### Realtime auth
- Frontend sets realtime auth with current token:
  - `supabase.realtime.setAuth(token)`

---

## 10. Support Bot Design

Bot identity:
- ID: `00000000-0000-0000-0000-000000000001`
- Secure ID: `SECURE-BOT-999`
- Username: `Support Bot`

Backend bot engine:
- `server/services/botService.ts`
- Keyword intent matching with predefined templates
- Endpoint: `POST /api/messages/bot-reply`

Current intent categories:
- encryption/security
- groups
- unlock/session password
- files
- notifications/unread badge
- account/login

You can extend bot coverage by adding intents/keywords/replies in `botService.ts`.

---

## 11. Security Notes

- Client message content is encrypted before send.
- Server should only store encrypted payloads for message content.
- Username fields in `users` are encrypted server-side by `serverCrypto`.
- Session password/key is temporary and memory-only on client.
- Backend uses request-local service-role client for DB operations.
- Auth validation handles transient network failures and returns clean `503` when auth service is unavailable.

---

## 12. Common Troubleshooting

### `42501 new row violates row-level security policy for table "messages"`
Likely causes:
- wrong Supabase key mapping
- stale/incorrect RLS policies

Actions:
1. verify `.env` keys (`SERVICE_ROLE` vs `ANON`)
2. reapply secure policies from `supabase.sql`
3. restart server and re-login

### `infinite recursion detected in policy for relation "groups"`
Cause:
- recursive policy definitions between `groups` and `group_members`

Action:
- replace with non-recursive policy/function strategy

### `relation "messages" is already member of publication "supabase_realtime"`
Cause:
- attempting to add existing realtime publication entry

Action:
- use conditional publication add block (already included in hardened SQL workflow)

### Bot reply appears then disappears
Cause:
- polling refresh replacing local temporary bot message list

Action:
- preserve local non-UUID temp messages during refresh (already implemented)

### Receiver does not see new chat in sidebar
Check:
- realtime auth token is set
- conversation refresh channel active
- fallback polling interval running

---

## 13. Development Guidelines

- Run type checks often: `npm run lint`
- Restart server after `.env` changes
- Re-login clients after auth/policy changes
- Keep SQL migrations idempotent (`IF EXISTS` / `IF NOT EXISTS`) where possible

---

## 14. Current Limitations

- Support Bot is rule-based (not generative AI).
- Unread counts are frontend session-state (not persisted across full reload/logout).
- Encryption metadata (salt/iv/type/timestamps) remains visible by design; only content is encrypted.

---

## 15. Next Recommended Improvements

1. Persist unread counts in DB with `last_read_at` per conversation.
2. Move bot knowledge to editable JSON file or admin UI.
3. Add automated tests for:
- policy-safe message send/read/delete
- group owner/member permissions
- unlock/decrypt flow
4. Add message pagination for large chat history.
