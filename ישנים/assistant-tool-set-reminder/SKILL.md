---
name: assistant-tool-set-reminder
description: This tool allows you to set a calendar reminder with a specified title, due date, and notes.
---

# Invocation

After reading this file, execute the builtin bridge tool `call_assistant_tool` with:

- `tool_name`: `set_reminder`
- `tool_arguments`: a JSON object serialized as a string

Build `tool_arguments` from the JSON schema below. `tool_arguments` must match the assistant tool input schema exactly. Do not omit required fields. Do not invent fields, rename fields, or change types. If the tool takes no arguments, pass `{}`.

## call_assistant_tool Example

```json
{
  "tool_name": "set_reminder",
  "tool_arguments": "{...valid JSON object matching the schema below...}"
}
```

## tool_arguments JSON Schema

```json
{"additionalProperties":false,"properties":{"due_date":{"description":"The due date and time for the reminder, in \"yyyy\/MM\/dd HH:mm:ss\" format. Example: 2025\/03\/28 09:12:19","examples":["2025\/03\/28 09:12:19"],"type":"string"},"notes":{"description":"Additional notes or details for the reminder. Example: notes here","examples":["notes here"],"type":"string"},"title":{"description":"The title of the reminder. This will be displayed as the main text of the reminder. Example: title here","examples":["title here"],"type":"string"}},"required":["title","due_date"],"type":"object"}
```