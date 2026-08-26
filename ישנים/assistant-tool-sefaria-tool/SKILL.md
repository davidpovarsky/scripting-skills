---
name: assistant-tool-sefaria-tool
description: חיפוש וקריאת טקסטים מהספרייה היהודית של Sefaria. תומך בשלוש פעולות: 1) search - חיפוש בספרייה (פרמטרים: query חובה, path אופציונלי כגון Tanakh/Talmud/Mishnah, exact אופציונלי, num_results אופציונלי). 2) read_text - קריאת טקסט לפי מראה מקום (פרמטר: reference, למשל Genesis 1:1 או Berakhot 2a). 3) get_commentaries - קבלת רשימת פרשנים על מראה מקום (פרמטר: reference). השתמש בכלי זה בכל פעם שנשאלת שאלה תורנית, הלכתית, או על טקסט יהודי.
---

# Invocation

After reading this file, execute the builtin bridge tool `call_assistant_tool` with:

- `tool_name`: `sefaria_tool`
- `tool_arguments`: a JSON object serialized as a string

Build `tool_arguments` from the JSON schema below. `tool_arguments` must match the assistant tool input schema exactly. Do not omit required fields. Do not invent fields, rename fields, or change types. If the tool takes no arguments, pass `{}`.

## call_assistant_tool Example

```json
{
  "tool_name": "sefaria_tool",
  "tool_arguments": "{...valid JSON object matching the schema below...}"
}
```

## tool_arguments JSON Schema

```json
{"additionalProperties":false,"properties":{},"required":[],"type":"object"}
```