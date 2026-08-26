---
name: assistant-tool-remove-reminders-by-identifiers
description: This tool allows you to remove reminders by their identifiers.
---

# Invocation

After reading this file, execute the builtin bridge tool `call_assistant_tool` with:

- `tool_name`: `remove_reminders_by_identifiers`
- `tool_arguments`: a JSON object serialized as a string

Build `tool_arguments` from the JSON schema below. `tool_arguments` must match the assistant tool input schema exactly. Do not omit required fields. Do not invent fields, rename fields, or change types. If the tool takes no arguments, pass `{}`.

## call_assistant_tool Example

```json
{
  "tool_name": "remove_reminders_by_identifiers",
  "tool_arguments": "{...valid JSON object matching the schema below...}"
}
```

## tool_arguments JSON Schema

```json
{"additionalProperties":false,"properties":{"identifiers":{"description":"A list of reminder identifiers to remove. Example: [\"identifier1\", \"identifier2\"]","examples":["[\"identifier1\", \"identifier2\"]"],"items":{"type":"string"},"type":"array"}},"required":["identifiers"],"type":"object"}
```