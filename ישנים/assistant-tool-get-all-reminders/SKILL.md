---
name: assistant-tool-get-all-reminders
description: This tool allows you to retrieve reminders, filtered by completion status and date range.
---

# Invocation

After reading this file, execute the builtin bridge tool `call_assistant_tool` with:

- `tool_name`: `get_all_reminders`
- `tool_arguments`: a JSON object serialized as a string

Build `tool_arguments` from the JSON schema below. `tool_arguments` must match the assistant tool input schema exactly. Do not omit required fields. Do not invent fields, rename fields, or change types. If the tool takes no arguments, pass `{}`.

## call_assistant_tool Example

```json
{
  "tool_name": "get_all_reminders",
  "tool_arguments": "{...valid JSON object matching the schema below...}"
}
```

## tool_arguments JSON Schema

```json
{"additionalProperties":false,"properties":{"end_date":{"description":"The end date for filtering reminders (YYYY\/MM\/DD HH:mm:ss). Only reminders due before this date will be retrieved. Example: 2024\/12\/31 23:59:59","examples":["2024\/12\/31 23:59:59"],"type":"string"},"reminder_type":{"description":"The completion status of reminders to retrieve. 'incomplete' for reminders that are not completed, 'completed' for reminders that are completed. Example: incomplete","enum":["incomplete","completed"],"examples":["incomplete"],"type":"string"},"start_date":{"description":"The start date for filtering reminders (YYYY\/MM\/DD HH:mm:ss). Only reminders due after this date will be retrieved. Example: 2024\/01\/01 00:00:00","examples":["2024\/01\/01 00:00:00"],"type":"string"}},"required":["reminder_type"],"type":"object"}
```