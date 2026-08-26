---
name: assistant-tool-delete-calendar-events
description: This tool allows you to delete calendar events based on their identifiers.
---

# Invocation

After reading this file, execute the builtin bridge tool `call_assistant_tool` with:

- `tool_name`: `delete_calendar_events`
- `tool_arguments`: a JSON object serialized as a string

Build `tool_arguments` from the JSON schema below. `tool_arguments` must match the assistant tool input schema exactly. Do not omit required fields. Do not invent fields, rename fields, or change types. If the tool takes no arguments, pass `{}`.

## call_assistant_tool Example

```json
{
  "tool_name": "delete_calendar_events",
  "tool_arguments": "{...valid JSON object matching the schema below...}"
}
```

## tool_arguments JSON Schema

```json
{"additionalProperties":false,"properties":{"identifiers":{"description":"An array of event identifiers to delete. Example: [\"event_id_1\", \"event_id_2\"]","examples":["[\"event_id_1\", \"event_id_2\"]"],"items":{"type":"string"},"type":"array"}},"required":["identifiers"],"type":"object"}
```