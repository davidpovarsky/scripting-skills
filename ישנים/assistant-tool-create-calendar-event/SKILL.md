---
name: assistant-tool-create-calendar-event
description: This tool allows you to create a calendar event with specified details.
---

# Invocation

After reading this file, execute the builtin bridge tool `call_assistant_tool` with:

- `tool_name`: `create_calendar_event`
- `tool_arguments`: a JSON object serialized as a string

Build `tool_arguments` from the JSON schema below. `tool_arguments` must match the assistant tool input schema exactly. Do not omit required fields. Do not invent fields, rename fields, or change types. If the tool takes no arguments, pass `{}`.

## call_assistant_tool Example

```json
{
  "tool_name": "create_calendar_event",
  "tool_arguments": "{...valid JSON object matching the schema below...}"
}
```

## tool_arguments JSON Schema

```json
{"additionalProperties":false,"properties":{"calendar":{"description":"The identifier of the calendar to create the event in. Example: Work","examples":["Work"],"type":"string"},"end_date":{"description":"The end date and time of the event. Example: yyyy\/MM\/dd HH:mm:ss","examples":["yyyy\/MM\/dd HH:mm:ss"],"type":"string"},"location":{"description":"The location of the event. Example: Conference Room","examples":["Conference Room"],"type":"string"},"notes":{"description":"Additional notes for the event. Example: Discuss project progress","examples":["Discuss project progress"],"type":"string"},"start_date":{"description":"The start date and time of the event. Example: yyyy\/MM\/dd HH:mm:ss","examples":["yyyy\/MM\/dd HH:mm:ss"],"type":"string"},"title":{"description":"The title of the event. Example: Meeting with John","examples":["Meeting with John"],"type":"string"}},"required":["title","start_date","end_date"],"type":"object"}
```