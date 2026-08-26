---
name: assistant-tool-get-all-notifications
description: This tool does not require user approval to query all notifications of a specified type, such as all pending notifications and all delivered notifications.
---

# Invocation

After reading this file, execute the builtin bridge tool `call_assistant_tool` with:

- `tool_name`: `get_all_notifications`
- `tool_arguments`: a JSON object serialized as a string

Build `tool_arguments` from the JSON schema below. `tool_arguments` must match the assistant tool input schema exactly. Do not omit required fields. Do not invent fields, rename fields, or change types. If the tool takes no arguments, pass `{}`.

## call_assistant_tool Example

```json
{
  "tool_name": "get_all_notifications",
  "tool_arguments": "{...valid JSON object matching the schema below...}"
}
```

## tool_arguments JSON Schema

```json
{"additionalProperties":false,"properties":{"type":{"description":"The type of the notifications to fetch. Example: pending","enum":["pending","delivered"],"examples":["pending"],"type":"string"}},"required":["type"],"type":"object"}
```