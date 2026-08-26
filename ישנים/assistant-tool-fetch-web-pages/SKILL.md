---
name: assistant-tool-fetch-web-pages
description: You can use this tool to fetch and convert webpages into markdown format by providing specific URLs.
---

# Invocation

After reading this file, execute the builtin bridge tool `call_assistant_tool` with:

- `tool_name`: `fetch_web_pages`
- `tool_arguments`: a JSON object serialized as a string

Build `tool_arguments` from the JSON schema below. `tool_arguments` must match the assistant tool input schema exactly. Do not omit required fields. Do not invent fields, rename fields, or change types. If the tool takes no arguments, pass `{}`.

## call_assistant_tool Example

```json
{
  "tool_name": "fetch_web_pages",
  "tool_arguments": "{...valid JSON object matching the schema below...}"
}
```

## tool_arguments JSON Schema

```json
{"additionalProperties":false,"properties":{"urls":{"description":"A list of webpage URLs to read. Example: [\"https:\/\/example.com\"]","examples":["[\"https:\/\/example.com\"]"],"items":{"type":"string"},"type":"array"}},"required":["urls"],"type":"object"}
```