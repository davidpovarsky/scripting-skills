---
name: assistant-tool-record-body-mass
description: This tool allows you to record your body mass.
---

# Invocation

After reading this file, execute the builtin bridge tool `call_assistant_tool` with:

- `tool_name`: `record_body_mass`
- `tool_arguments`: a JSON object serialized as a string

Build `tool_arguments` from the JSON schema below. `tool_arguments` must match the assistant tool input schema exactly. Do not omit required fields. Do not invent fields, rename fields, or change types. If the tool takes no arguments, pass `{}`.

## call_assistant_tool Example

```json
{
  "tool_name": "record_body_mass",
  "tool_arguments": "{...valid JSON object matching the schema below...}"
}
```

## tool_arguments JSON Schema

```json
{"additionalProperties":false,"properties":{"body_mass":{"description":"Your body mass in kilograms. Example: e.g., 70.5","examples":["e.g., 70.5"],"type":"number"},"date":{"description":"The date of the measurement (yyyy\/MM\/dd HH:mm:ss). Example: yyyy\/MM\/dd HH:mm:ss","examples":["yyyy\/MM\/dd HH:mm:ss"],"type":"string"}},"required":["body_mass"],"type":"object"}
```