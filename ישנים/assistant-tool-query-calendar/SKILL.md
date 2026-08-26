---
name: assistant-tool-query-calendar
description: This tool allows you to query calendars. You can provide an array of identifiers to query specific calendars. If no identifiers are provided, all calendars will be returned.
---

# Invocation

After reading this file, execute the builtin bridge tool `call_assistant_tool` with:

- `tool_name`: `query_calendar`
- `tool_arguments`: a JSON object serialized as a string

Build `tool_arguments` from the JSON schema below. `tool_arguments` must match the assistant tool input schema exactly. Do not omit required fields. Do not invent fields, rename fields, or change types. If the tool takes no arguments, pass `{}`.

## call_assistant_tool Example

```json
{
  "tool_name": "query_calendar",
  "tool_arguments": "{...valid JSON object matching the schema below...}"
}
```

## tool_arguments JSON Schema

```json
{"additionalProperties":false,"properties":{"entity_type":{"description":"The type of calendar to query: event or reminder. Example: event","enum":["event","reminder"],"examples":["event"],"type":"string"},"identifiers":{"description":"An array of calendar identifiers to query. If empty, all calendars will be returned. Example: [\"identifier1\", \"identifier2\"]","examples":["[\"identifier1\", \"identifier2\"]"],"items":{"type":"string"},"type":"array"}},"required":["entity_type"],"type":"object"}
```