---
name: assistant-tool-schedule-notification
description: Schedules the delivery of a local notification.
---

# Invocation

After reading this file, execute the builtin bridge tool `call_assistant_tool` with:

- `tool_name`: `schedule_notification`
- `tool_arguments`: a JSON object serialized as a string

Build `tool_arguments` from the JSON schema below. `tool_arguments` must match the assistant tool input schema exactly. Do not omit required fields. Do not invent fields, rename fields, or change types. If the tool takes no arguments, pass `{}`.

## call_assistant_tool Example

```json
{
  "tool_name": "schedule_notification",
  "tool_arguments": "{...valid JSON object matching the schema below...}"
}
```

## tool_arguments JSON Schema

```json
{"additionalProperties":false,"properties":{"body":{"description":"Specify the body of the notification alert. Example: body here","examples":["body here"],"type":"string"},"repeats_type":{"description":"Specify a type to reschedule the notification request each time the system delivers the notification with a given `trigger_time` value. If the `trigger_time` param is provided, not provide this param to deliver the notification one time. Example: daily","enum":["hourly","daily","weekly","monthly"],"examples":["daily"],"type":"string"},"silent":{"description":"If the value is true, when the system delivers the notification and would not play the system default sound. Defaults to true. Example: false","examples":["false"],"type":"boolean"},"subtitle":{"description":"Specify additional context about the purpose of the notification. Example: subtitle here","examples":["subtitle here"],"type":"string"},"title":{"description":"Specify the title of your notification alert. Example: title here","examples":["title here"],"type":"string"},"trigger_time":{"description":"A specified time in \"yyyy\/MM\/dd HH:mm:ss\" format that causes the system to deliver the notification. Not provide this param to deliver the notification right away. Example: 2025\/03\/28 09:12:19","examples":["2025\/03\/28 09:12:19"],"type":"string"}},"required":["title"],"type":"object"}
```