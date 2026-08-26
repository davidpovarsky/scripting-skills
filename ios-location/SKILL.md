---
name: ios-location
description: Access iOS location services — get current location, geocode addresses, reverse geocode coordinates, get compass heading, and pick location from map.
runtime: node
metadata:
  display_name: "iOS Location"
  required_tools: "run_shell_command"
---

# Purpose

This skill provides scripts for accessing iOS location services through the Scripting TypeScript runtime. Use it when the user wants to get current device location, convert addresses to coordinates (geocoding), convert coordinates to addresses (reverse geocoding), get compass heading, or pick a location from the map.

# Available Scripts

All scripts are executed via `run_shell_command` using `scripting-ts run`. Pass parameters as a JSON string with `--queryparameters`.

## get_current_location.ts

Get the device's current geographic location.

```
scripting-ts run <skill_dir>/scripts/get_current_location.ts --queryparameters '{"accuracy":"best","force_request":true}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `accuracy` | string | No | Location accuracy: `"best"`, `"tenMeters"`, `"hundredMeters"`, `"kilometer"`, `"threeKilometers"`, `"bestForNavigation"`, `"reduced"`. Default: `"best"`. |
| `force_request` | boolean | No | Force a fresh location request, ignoring cache. Default: `false`. |

**Output:** JSON object with `success`, `latitude`, `longitude`, `timestamp` fields.

## geocode_address.ts

Convert a textual address to geographic coordinates.

```
scripting-ts run <skill_dir>/scripts/geocode_address.ts --queryparameters '{"address":"Times Square, New York","locale":"en-US"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `address` | string | Yes | The address to geocode. |
| `locale` | string | No | Locale for results (e.g. `"en-US"`, `"zh-CN"`). |

**Output:** JSON array of placemark objects with location and address components.

## reverse_geocode.ts

Convert geographic coordinates to human-readable address information.

```
scripting-ts run <skill_dir>/scripts/reverse_geocode.ts --queryparameters '{"latitude":39.9042,"longitude":116.4074,"locale":"zh-CN"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `latitude` | number | Yes | Latitude in degrees. |
| `longitude` | number | Yes | Longitude in degrees. |
| `locale` | string | No | Locale for results. |

**Output:** JSON array of placemark objects with address components.

## get_heading.ts

Get the device's current compass heading.

```
scripting-ts run <skill_dir>/scripts/get_heading.ts
```

**Parameters:** None.

**Output:** JSON object with `trueHeading`, `magneticHeading`, `headingAccuracy`, and `timestamp` fields.

## pick_from_map.ts

Present the system map interface for the user to pick a location.

```
scripting-ts run <skill_dir>/scripts/pick_from_map.ts
```

**Parameters:** None.

**Output:** JSON object with `success`, `latitude`, `longitude` fields. Returns `success: false` if user cancels.

# Instructions

1. Determine which script to use based on the user's request.
2. Build the `--queryparameters` JSON from the user's input.
3. Execute via `run_shell_command` with `scripting-ts run <path> --queryparameters '<json>'`.
4. Parse the JSON output and present the result to the user.
5. For location requests, inform the user that location permissions may be required.
