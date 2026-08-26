---
name: otzaria-ui-test
description: Minimal diagnostic skill for testing whether Scripting renders inline chat UI from a scripting-file block. Use when the user asks to test Otzaria UI rendering, scripting-file rendering, or says "בדיקת UI של אוצריא". Output a tiny scripting-file block pointing to a rich-maps-style renderer.
metadata:
  display_name: "Otzaria UI Test"
  intent_patterns: "בדיקת UI של אוצריא, otzaria ui test, scripting-file test, בדיקת scripting-file"
---

# Otzaria UI Test

When invoked, output a `scripting-file` block pointing to the test renderer.

Use this exact shape:

````markdown
```scripting-file
{
  "path": "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/otzaria-ui-test/scripts/test-renderer.tsx",
  "props": {
    "query": "קטן אוכל נבלות",
    "label": "בדיקת רינדור UI של אוצריא"
  }
}
```
````

The renderer intentionally follows the same inline-rendering shape as `rich-maps`: root `ScrollView`, inner `VStack`, simple `Text` nodes only. It does not use `List`, `Section`, `Button`, database access, async work, or internal imports.
