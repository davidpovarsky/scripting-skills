---
name: assistant-tool-select-options
description: Ask the user to choose one or more options before the assistant continues.
---

# Invocation

After reading this file, execute the builtin bridge tool `call_assistant_tool` with:

- `tool_name`: `select_options`
- `tool_arguments`: a JSON object serialized as a string

Build `tool_arguments` from the JSON schema below. `tool_arguments` must match the assistant tool input schema exactly. Do not omit required fields. Do not invent fields, rename fields, or change types. If the tool takes no arguments, pass `{}`.

## call_assistant_tool Example

```json
{
  "tool_name": "select_options",
  "tool_arguments": "{...valid JSON object matching the schema below...}"
}
```

## tool_arguments JSON Schema

```json
{"additionalProperties":false,"properties":{"cancelLabel":{"description":"Optional cancel button label. Example: Cancel","examples":["Cancel"],"type":"string"},"defaultSelectedIds":{"description":"Optional initial selected option ids. Example: [\"dev\"]","examples":["[\"dev\"]"],"items":{"type":"string"},"type":"array"},"description":{"description":"Optional subtitle\/description shown under title. Example: Select where this release should be deployed.","examples":["Select where this release should be deployed."],"type":"string"},"maxSelection":{"description":"Maximum allowed selected options. Only valid when selectionMode is multiple. Example: 2","examples":["2"],"type":"number"},"minSelection":{"description":"Minimum required selected options. Example: 1","examples":["1"],"type":"number"},"options":{"description":"Selectable options. Each item supports id, label, optional description, optional disabled. Example: [{\"id\":\"dev\",\"label\":\"Development\"},{\"id\":\"prod\",\"label\":\"Production\"}]","examples":["[{\"id\":\"dev\",\"label\":\"Development\"},{\"id\":\"prod\",\"label\":\"Production\"}]"],"items":{"type":"string"},"type":"array"},"selectionMode":{"description":"single: user can choose one option. multiple: user can choose multiple options. Example: single","enum":["single","multiple"],"examples":["single"],"type":"string"},"submitLabel":{"description":"Optional submit button label. Example: Confirm","examples":["Confirm"],"type":"string"},"title":{"description":"The title shown in the tool UI. Example: Choose deployment environments","examples":["Choose deployment environments"],"type":"string"}},"required":["title","options","selectionMode"],"type":"object"}
```