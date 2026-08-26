---
name: otzaria-torah
description: Use when the user asks to search, find, open, show, browse, or visually display Torah sources in the local Otzaria/Seforim database, including Hebrew questions like "איפה כתוב ...". For ordinary Otzaria search/display requests, output a tiny ```scripting-file``` block that renders the bundled rich-maps-style inline UI from this skill. The UI script fetches results directly from the local database; never pass search results in props.
metadata:
  display_name: "Otzaria Torah"
  intent_patterns: "אוצריא, otzaria, seforim, Torah search, חיפוש תורני, מקור, מקורות, איפה כתוב, קטן אוכל נבלות"
---

# Otzaria Torah

Use this skill when the user asks to search, find, open, show, browse, or visually display Torah sources in Otzaria.

## Main behavior

For a normal Otzaria search or visual display request, output a `scripting-file` block. The renderer script opens the local database and fetches all results directly.

The `props` must stay tiny. Pass only small controls like `action`, `query`, `ref`, `lineId`, `bookId`, `lineIndex`, `radius`, `limit`, or `mode`.

Never put search results, source text, database rows, previews, arrays of results, or large JSON inside `props`.

The renderer is built for inline chat rendering in the same shape as `rich-maps`: root `ScrollView`, inner `VStack`, compact `Text` cards. It does not use `List` or `Section`.

## Search UI

For search requests, output this shape and replace only the query text and small scalar controls:

````markdown
```scripting-file
{
  "path": "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/otzaria-torah/scripts/otzaria-live-search.tsx",
  "props": {
    "action": "search",
    "query": "קטן אוכל נבלות",
    "limit": 20
  }
}
```
````

## Reference / context UI

When the user explicitly asks to open a reference, context, links, TOC, or another non-live-search view, use the normal renderer with tiny props:

````markdown
```scripting-file
{
  "path": "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/otzaria-torah/scripts/otzaria-renderer.tsx",
  "props": {
    "action": "read_ref",
    "ref": "בראשית א, א",
    "limit": 20
  }
}
```
````

## Forbidden for user-facing display

Do not use `call_assistant_tool` for Otzaria. It is legacy and may return huge JSON or fail.

Do not use `scripting-ts preview_ui` for user-facing display. It is only a temporary diagnostic preview window.

Do not use `scripting-ts run` or `run_shell_command` for ordinary visual display requests.

If the user says the visual block did not render, output the same `scripting-file` block again with the correct path and props. Do not switch to `preview_ui`.
