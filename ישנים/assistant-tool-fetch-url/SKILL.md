---
name: assistant-tool-fetch-url
description: Use this when you need the raw HTTP response for non-HTML content or APIs. Examples: JSON, XML, RSS/Atom, CSV, plain text, files, or downloads. If the target is a human-readable web page (HTML) that should be converted to markdown, use fetch_web_content instead.
---

# Invocation

After reading this file, execute the builtin bridge tool `call_assistant_tool` with:

- `tool_name`: `fetch_url`
- `tool_arguments`: a JSON object serialized as a string

Build `tool_arguments` from the JSON schema below. `tool_arguments` must match the assistant tool input schema exactly. Do not omit required fields. Do not invent fields, rename fields, or change types. If the tool takes no arguments, pass `{}`.

## call_assistant_tool Example

```json
{
  "tool_name": "fetch_url",
  "tool_arguments": "{...valid JSON object matching the schema below...}"
}
```

## tool_arguments JSON Schema

```json
{"additionalProperties":false,"properties":{"headers":{"description":"Optional per-URL headers array. Each item maps to the same index in urls. Example: [{\"accept\":\"application\/json\"}, {\"accept\":\"text\/plain\"}]","examples":["[{\"accept\":\"application\/json\"}, {\"accept\":\"text\/plain\"}]"],"items":{"type":"string"},"type":"array"},"urls":{"description":"A list of URLs to fetch (usually API endpoints or non-HTML resources). Example: [\"https:\/\/example.com\"]","examples":["[\"https:\/\/example.com\"]"],"items":{"type":"string"},"type":"array"}},"required":["urls"],"type":"object"}
```