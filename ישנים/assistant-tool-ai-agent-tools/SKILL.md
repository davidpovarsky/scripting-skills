---
name: assistant-tool-ai-agent-tools
description: Runs the AI Agent's tool loop. The agent can answer directly, call one or more internal tools, or combine a short text response with tool calls. Internal tools include weather lookup, reminder creation, and Wikipedia-based encyclopedic lookup for people, places, cities, countries, organizations, events, concepts, landmarks, works, and other notable topics.
---

# Invocation

After reading this file, execute the builtin bridge tool `call_assistant_tool` with:

- `tool_name`: `ai_agent_tools`
- `tool_arguments`: a JSON object serialized as a string

Build `tool_arguments` from the JSON schema below. `tool_arguments` must match the assistant tool input schema exactly. Do not omit required fields. Do not invent fields, rename fields, or change types. If the tool takes no arguments, pass `{}`.

## call_assistant_tool Example

```json
{
  "tool_name": "ai_agent_tools",
  "tool_arguments": "{...valid JSON object matching the schema below...}"
}
```

## tool_arguments JSON Schema

```json
{"additionalProperties":false,"properties":{},"required":[],"type":"object"}
```