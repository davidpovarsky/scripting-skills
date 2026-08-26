---
name: telegram-search
description: Full personal Telegram API access from Scripting through embedded Python/Telethon, with a high-level query engine for compact server-side filtering of messages, Saved Messages, files/media, dates, senders, chats and pagination, durable inline native file cards for downloaded media, canonical message references that avoid Telegram peer-ID guessing, plus message/chat mutations and the full Telegram Raw API.
runtime: node
metadata:
  display_name: "Telegram API"
  required_tools: "run_shell_command"
  intent_patterns: "טלגרם, Telegram, TG, הודעות שמורות, Saved Messages, חיפוש טלגרם, קבצים בטלגרם, ספרים בטלגרם, שלח בטלגרם, הורד מטלגרם, ערוך הודעה, מחק הודעה, העבר הודעה, ערוץ טלגרם, קבוצת טלגרם, 电报, 纸飞机"
---

# Telegram API

Use the user's own Telegram account through the **telrgram api** Scripting project. It connects directly to Telegram with embedded Python and Telethon 1.44.0. There is no iSH server and no localhost bridge.

Runner:

`/private/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripts/telrgram api/scripts/telegram-run.ts`

Always execute it as one standalone `scripting-ts run` command. Do not prepend `cd`, and do not append pipes, `&&`, `;`, redirects, grep, Python snippets, or shell-side filtering.

## Core rule: query/filter inside the Telegram project

Prefer `query_messages` or one of its aliases. Pass date/media/sender/chat/file/output filters as parameters so Telegram returns only the compact data required. Never fetch a large history and then create temporary Python/regex/grep scripts to filter it.

Agent calls are compact by default: routine TypeScript/Python diagnostics are not printed into shell stdout. Add `"debug":true` only when the user explicitly asks for diagnostics or when troubleshooting a failed operation.

Discover the full parameter schema:

```bash
scripting-ts run "/private/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripts/telrgram api/scripts/telegram-run.ts" --queryparameters '{"action":"query_schema"}'
```

General capabilities:

```bash
scripting-ts run "/private/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripts/telrgram api/scripts/telegram-run.ts" --queryparameters '{"action":"capabilities"}'
```

## Universal query engine

```bash
scripting-ts run "/private/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripts/telrgram api/scripts/telegram-run.ts" --queryparameters '{"action":"query_messages","scope":"saved|global|chat","entity":"optional chat","query":"optional text","limit":20,"compact":true}'
```

Important parameters:

- Scope: `scope` (`saved`, `global`, `chat`), `entity`, `peer`, `chat`, `threadId`, `fromUser`.
- Search: `query`, `queries`, `perQueryLimit`, `queryMode`/`matchMode` (`any`, `all`, `exact`, `prefix`, `regex`), `exclude`, `localTerms`.
- Time: `since`, `until`, `sinceDays`/`lastDays`, `sinceHours`/`lastHours`, `sinceMinutes`/`lastMinutes`, `period`, `timezoneOffsetMinutes`.
- Period values: `today`, `yesterday`, `this_week`, `last_24_hours`, `last_7_days`, `last_14_days`, `last_30_days`, `this_month`.
- Media: `preset` (`books`, `files`, `media`, `links`), `mediaType`/`filter`, `extensions`, `mimeTypes`, `filenameContains`, `filenameRegex`, `minBytes`, `maxBytes`, `minMB`, `maxMB`.
- Flags: `hasMedia`, `hasDocument`, `hasPhoto`, `hasFile`, `hasText`, `hasLink`, `outgoing`, `incoming`, `pinned`, `forwarded`, `hasReply`, `replyToMessageId`.
- Sender/chat: `senderId(s)`, `senderUsername(s)`, `senderNameContains`, `chatId(s)`, `chatType(s)`, `chatTitleContains`.
- Pagination: `offsetId`/`beforeId`, `minId`/`afterId`, `maxId`, `offsetDate`, `addOffset`, `sort`, `reverse`.
- Output: `limit`, `maxScanned`, `fields`/`select`, `compact`, `textMaxLength`, `dedupeBy`, `groupBy`, `countOnly`, `skip`.

## Book searches — prefer the books bot at t.me/king_of_telegram_b
When the user asks to **find/search for a book by title**, prefer the books bot reachable at `https://t.me/king_of_telegram_b/4655` instead of starting with a broad global/Saved Messages search.

The bot operates inside the public group **"מלך הטלגרם , סרטים , סדרות וספרים ."** — entity `king_of_telegram_b`, canonical id `-1002495596306`, chatType `group`. Send the title as a normal message to the group and the bot replies with the matching results.
1. Send the book title as a message to the bot:
```bash
scripting-ts run "/private/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripts/telrgram api/scripts/telegram-run.ts" --queryparameters '{"action":"send_message","entity":"king_of_telegram_b","text":"BOOK TITLE"}'

2. Read the bot chat for the matching incoming book result(s), keeping messageRef for any file that may be downloaded:

scripting-ts run "/private/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripts/telrgram api/scripts/telegram-run.ts" --queryparameters '{"action":"query_messages","scope":"chat","entity":"king_of_telegram_b","query":"BOOK TITLE","incoming":true,"sinceMinutes":10,"sort":"newest","limit":20,"fields":["id","date","text","file.name","file.size","link"]}'

3. If the user wants the file, download it using the returned messageRef and then follow the mandatory inline attachment-card presentation path below.

A user request to search/find a book is sufficient authorization to send that book title to this bot as the search query. Do not send unrelated messages to the bot. If the bot yields no useful result, then fall back to the general Telegram query engine.

```bash
scripting-ts run "/private/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripts/telrgram api/scripts/telegram-run.ts" --queryparameters '{"action":"saved_books","sinceDays":14,"sort":"newest","limit":20,"fields":["id","date","file.name","file.size","link"]}'
```

### Recent PDF/EPUB files in Saved Messages

```bash
scripting-ts run "/private/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripts/telrgram api/scripts/telegram-run.ts" --queryparameters '{"action":"saved_recent_files","sinceDays":14,"extensions":["pdf","epub"],"limit":20,"fields":["id","date","file.name","file.size","link"]}'
```

### Multilingual global variants

```bash
scripting-ts run "/private/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripts/telrgram api/scripts/telegram-run.ts" --queryparameters '{"action":"query_messages","scope":"global","queries":["Scripting TG","Scripting Telegram","Scripting 电报"],"sinceDays":30,"limit":25,"perQueryLimit":15}'
```

## High-level aliases

`recent_messages`, `recent_files`, `find_files`, `find_media`, `find_links`, `saved_recent`, `saved_recent_files`, `saved_books`. Existing `history`, `search`, `search_chat`, `saved_history`, `saved_search`, and `saved_files` accept the same filtering/output parameters.

## Dialog queries

`query_dialogs`/`dialogs` supports `query`/`queries`, `archived`, `folder`, `unreadOnly`, `minUnread`, `pinned`, `hasUsername`, `chatType(s)`, `username(s)`, `sort`, `fields`, `countOnly`, and `scanLimit`.

## Canonical message references — never reconstruct peer IDs yourself

Every message query now returns a small `messageRef` even when `fields`/`select` projects other fields. Example:

```json
{"entity":"-1001183100711","messageId":"20381","chatType":"channel"}
```

Use this reference directly for follow-up operations. **Do not derive an entity from `chat.id`, do not guess whether a positive number is a user or channel, and never prepend `-100` yourself.** The project normalizes Telegram entities internally and also resolves legacy positive numeric IDs against known dialogs as a fallback.

For searches whose results may later be downloaded, keep the returned `messageRef`; it is the preferred stable handle.

## Exact messages and downloads

Fetch a specific message using the canonical reference returned by search:

```bash
scripting-ts run "/private/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripts/telrgram api/scripts/telegram-run.ts" --queryparameters '{"action":"get_message","messageRef":{"entity":"-1001183100711","messageId":"20381"},"fields":["id","date","text","file","link"]}'
```

Download one result without reconstructing the chat/entity:

```bash
scripting-ts run "/private/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripts/telrgram api/scripts/telegram-run.ts" --queryparameters '{"action":"download_media","messageRef":{"entity":"-1001183100711","messageId":"20381"}}'
```

Download multiple results — including results from different chats/channels — in one call:

```bash
scripting-ts run "/private/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripts/telrgram api/scripts/telegram-run.ts" --queryparameters '{"action":"download_media_batch","messageRefs":[{"entity":"-1001183100711","messageId":"20381"},{"entity":"king_of_telegram_b","messageId":"1268"}]}'
```

Legacy `entity` + `messageId(s)` remains supported, but `messageRef` / `messageRefs` is preferred whenever the reference came from a query result.

### Inline attachment cards after downloads — mandatory presentation path

Attachment-card renderer installed with this Skill:

`/private/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/telegram-search/scripts/file-results.tsx`

Successful `download_media`, `download_media_batch`, and `download_profile_photo` results include both:

- `ui.scriptingFile` — the prepared `{path, props}` object.
- `scriptingFileBlock` — the complete ready-to-render fenced block.

**Critical rule:** when `scriptingFileBlock` is present, the next assistant response must output that exact block verbatim. Prefer making it the entire response. Do not translate it, rewrite its path/props, build TSX yourself, or convert the local path into a Markdown link.

Inside `props`, downloaded file locations use the key `filePath`, never `path`. In a `scripting-file` block, `path` is reserved for the top-level Scripting UI entry file.

The correct response shape is exactly the block returned by the runner, for example:

````markdown
```scripting-file
{
  "path": ".../scripting-skills/telegram-search/scripts/file-results.tsx",
  "props": {
    "files": [
      { "filePath": "/.../book.epub", "name": "book.epub", "size": 123456, "ext": ".epub" }
    ]
  }
}
```
````

**Never create `[פתיחה](...)`, `file://...`, sandbox-style, temporary, or guessed local-file links.** Scripting does not treat those as the persistent downloaded-file card and they can produce “The file no longer exists.”

**Never verify a successful download with `ls`, `stat`, `find`, `cat`, another Python snippet, or another shell command.** The download result is authoritative. Version 2.4 uses a durable per-request result file and writes download snapshots immediately. Only inspect the filesystem when the user explicitly asks for diagnostics.

The renderer intentionally uses only lightweight inline-Scripting primitives. Each downloaded file is shown as one minimal attachment card: a small file-type icon on the left, the filename on a single line, and a subtle chevron on the right, inside a softly rounded system-gray row. There is no title, subtitle, metadata line, thumbnail, footer, ellipsis menu, or nested file-browser UI. Tapping anywhere on the card opens the downloaded file through the owning `telrgram api` project and native Quick Look. Multiple downloads are rendered as a simple vertical stack of identical attachment cards.

## Other convenience actions and full Raw API

Convenience actions remain for sending/editing/deleting/forwarding, reactions, pins/read state, contacts, drafts, members/admins/permissions, join/leave, archive, block, profile photos and inline queries.

For anything not covered: `api_methods` -> find TL methods, `raw_method_info` -> inspect the signature, `raw_api` -> invoke the Telegram TL method. Do not claim an operation is unsupported before checking these.

## Safety and credentials

Read/search actions may be used when requested. Telegram-state mutations must only be executed when the current request explicitly calls for them. Never expose StringSession, API Hash, login codes, 2FA passwords or phone-code hashes. Credentials remain in Keychain with encrypted shared recovery across project updates.
