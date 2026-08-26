---
name: assistant-tool-deep-research
description: This tool performs deep research on a given topic by generating search keywords, collecting information, and iteratively refining the search until sufficient information is gathered.
---

# Invocation

After reading this file, execute the builtin bridge tool `call_assistant_tool` with:

- `tool_name`: `deep_research`
- `tool_arguments`: a JSON object serialized as a string

Build `tool_arguments` from the JSON schema below. `tool_arguments` must match the assistant tool input schema exactly. Do not omit required fields. Do not invent fields, rename fields, or change types. If the tool takes no arguments, pass `{}`.

## call_assistant_tool Example

```json
{
  "tool_name": "deep_research",
  "tool_arguments": "{...valid JSON object matching the schema below...}"
}
```

## tool_arguments JSON Schema

```json
{"additionalProperties":false,"properties":{"research_topic":{"description":"The topic to research. Example: e.g., \"The impact of AI on education\"","examples":["e.g., \"The impact of AI on education\""],"type":"string"}},"required":["research_topic"],"type":"object"}
```