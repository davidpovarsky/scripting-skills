---
name: assistant-tool-transit-directions
description: Finds public transit routes in Israel and renders a compact native route picker UI with a MapKit map, route polylines, and stop markers. The user confirms the selected route before the assistant continues. Set autoComplete=true only when you intentionally want the fastest route returned automatically.
---

# Invocation

After reading this file, execute the builtin bridge tool `call_assistant_tool` with:

- `tool_name`: `transit_directions`
- `tool_arguments`: a JSON object serialized as a string

Build `tool_arguments` from the JSON schema below. `tool_arguments` must match the assistant tool input schema exactly. Do not omit required fields. Do not invent fields, rename fields, or change types. If the tool takes no arguments, pass `{}`.

## call_assistant_tool Example

```json
{
  "tool_name": "transit_directions",
  "tool_arguments": "{...valid JSON object matching the schema below...}"
}
```

## tool_arguments JSON Schema

```json
{"additionalProperties":false,"properties":{"autoComplete":{"description":"When true, the fastest route is returned automatically after it is found. Default is false; the user confirms the selected route in the UI. Example: false","examples":["false"],"type":"boolean"},"autoUseCurrentLocation":{"description":"When true, request current device location if no origin or origin coordinates are supplied. Default is true. Example: true","examples":["true"],"type":"boolean"},"destination":{"description":"Destination address or place name. Preferred destination field. Example: התחנה המרכזית ירושלים","examples":["התחנה המרכזית ירושלים"],"type":"string"},"destinationQuery":{"description":"Alias for destination. Example: התחנה המרכזית ירושלים","examples":["התחנה המרכזית ירושלים"],"type":"string"},"from":{"description":"Alias for origin. Example: קניון רמות ירושלים","examples":["קניון רמות ירושלים"],"type":"string"},"fromLat":{"description":"Optional origin latitude. Example: 31.81742","examples":["31.81742"],"type":"number"},"fromLng":{"description":"Alias for origin longitude. Example: 35.194919","examples":["35.194919"],"type":"number"},"fromLon":{"description":"Optional origin longitude. Example: 35.194919","examples":["35.194919"],"type":"number"},"fromQuery":{"description":"Alias for origin. Example: קניון רמות ירושלים","examples":["קניון רמות ירושלים"],"type":"string"},"locale":{"description":"Locale for search and display. Default is he. Example: he","examples":["he"],"type":"string"},"maxWalkDistance":{"description":"Maximum walking distance in meters. Default is 1207. Example: 1207","examples":["1207"],"type":"number"},"numItineraries":{"description":"Number of route alternatives to show. Default is 3. Example: 3","examples":["3"],"type":"number"},"origin":{"description":"Origin address or place name. If omitted, coordinates are used when supplied; otherwise the current device location is requested. Example: קניון רמות ירושלים","examples":["קניון רמות ירושלים"],"type":"string"},"originLatitude":{"description":"Alias for origin latitude. Example: 31.81742","examples":["31.81742"],"type":"number"},"originLongitude":{"description":"Alias for origin longitude. Example: 35.194919","examples":["35.194919"],"type":"number"},"to":{"description":"Alias for destination. Example: התחנה המרכזית ירושלים","examples":["התחנה המרכזית ירושלים"],"type":"string"},"toQuery":{"description":"Alias for destination. Example: התחנה המרכזית ירושלים","examples":["התחנה המרכזית ירושלים"],"type":"string"}},"required":[],"type":"object"}
```