---
name: assistant-tool-request-current-location
description: This tool allows you to request the one-time delivery of the latitude and longitude of the user’s current location.
---

# Invocation

After reading this file, execute the builtin bridge tool `call_assistant_tool` with:

- `tool_name`: `request_current_location`
- `tool_arguments`: a JSON object serialized as a string

Build `tool_arguments` from the JSON schema below. `tool_arguments` must match the assistant tool input schema exactly. Do not omit required fields. Do not invent fields, rename fields, or change types. If the tool takes no arguments, pass `{}`.

## call_assistant_tool Example

```json
{
  "tool_name": "request_current_location",
  "tool_arguments": "{...valid JSON object matching the schema below...}"
}
```

## tool_arguments JSON Schema

```json
{"additionalProperties":false,"properties":{},"required":[],"type":"object"}
```