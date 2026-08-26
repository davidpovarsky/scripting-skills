---
name: assistant-tool-remove-notifications
description: This tool allows you to remove notifications by identifiers and specified type.
---

# Invocation

After reading this file, execute the builtin bridge tool `call_assistant_tool` with:

- `tool_name`: `remove_notifications`
- `tool_arguments`: a JSON object serialized as a string

Build `tool_arguments` from the JSON schema below. `tool_arguments` must match the assistant tool input schema exactly. Do not omit required fields. Do not invent fields, rename fields, or change types. If the tool takes no arguments, pass `{}`.

## call_assistant_tool Example

```json
{
  "tool_name": "remove_notifications",
  "tool_arguments": "{...valid JSON object matching the schema below...}"
}
```

## tool_arguments JSON Schema

```json
{"additionalProperties":false,"properties":{"identifiers":{"description":"An array of notification identifiers to remove. Example: [\"identifier1\", \"identifier2\"]","examples":["[\"identifier1\", \"identifier2\"]"],"items":{"type":"string"},"type":"array"},"type":{"description":"The type of the notifications to delete. Example: pending","enum":["pending","delivered"],"examples":["pending"],"type":"string"}},"required":["identifiers","type"],"type":"object"}
```