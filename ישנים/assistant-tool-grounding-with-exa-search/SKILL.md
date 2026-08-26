---
name: assistant-tool-grounding-with-exa-search
description: Use this tool when you need up-to-date information from the internet. It grounds the model with real-time Exa Search results across languages, improving factual accuracy and enabling responses with verifiable citations beyond the model's knowledge cutoff.
---

# Invocation

After reading this file, execute the builtin bridge tool `call_assistant_tool` with:

- `tool_name`: `grounding_with_exa_search`
- `tool_arguments`: a JSON object serialized as a string

Build `tool_arguments` from the JSON schema below. `tool_arguments` must match the assistant tool input schema exactly. Do not omit required fields. Do not invent fields, rename fields, or change types. If the tool takes no arguments, pass `{}`.

## call_assistant_tool Example

```json
{
  "tool_name": "grounding_with_exa_search",
  "tool_arguments": "{...valid JSON object matching the schema below...}"
}
```

## tool_arguments JSON Schema

```json
{"additionalProperties":false,"properties":{"limit":{"description":"The maximum number of search results to return. Example: e.g., 5","examples":["e.g., 5"],"type":"number"},"query":{"description":"The search query to look up on the web. Example: e.g., \"Who won the euro 2024?\"","examples":["e.g., \"Who won the euro 2024?\""],"type":"string"}},"required":["query"],"type":"object"}
```