---
name: create-safari-browser-script
description: Guide for creating Safari browser userscripts in Scripting, including browser.tsx project scripts and installed .user.js files with GM APIs and Scripting.FileManager.
metadata:
  display_name: "Create Safari Browser Script"
  intent_patterns: "safari browser script, safari web extension, userscript, user.js, tampermonkey, greasemonkey, GM api, browser.tsx, website automation"
  required_tools: "scripting_reference, run_shell_command, file_tool"
---

# Purpose

Use this skill when the user wants to create or modify a Safari browser script for the Scripting app. Safari browser scripts run inside Safari through Scripting's Safari Web Extension and can automate websites, add page UI, register extension popup menu commands, persist data, download files, and call supported `GM.*` APIs.

# Instructions

## Choose the Script Location

Use one of these locations:

- For a Scripting project, create or edit `browser.tsx`. The app builds it into `browser.js` for Safari.
- For an installed userscript, create a `.user.js` or `.js` file in `FileManager.safariBrowserUserscriptsDirectory` or the prompt-provided `safari_browser_userscripts_directory`.

Use installed `.user.js` files when the user wants a Tampermonkey/Greasemonkey-style script that can be managed from Safari's extension popup. Use `browser.tsx` when the script belongs to the current Scripting project.

## Metadata Block

Every Safari browser script should start with a userscript metadata block:

```js
// ==UserScript==
// @name Safari Browser Script
// @match https://example.com/*
// @run-at document-end
// @grant GM.log
// ==/UserScript==
```

Important metadata keys:

- `@name`: Human-readable script name.
- `@match` / `@include`: Pages where the script should run.
- `@exclude` / `@exclude-match`: Pages where the script should not run.
- `@run-at`: `document-start`, `document-body`, `document-end`, or `document-idle`. The default is `document-end`.
- `@grant`: Required for privileged APIs such as `GM.getValue`, `GM.xmlHttpRequest`, `GM.download`, `GM.cookie`, and `Scripting.FileManager`.
- `@connect`: Required for cross-origin network, download, resource, and cookie access.
- `@require`: Loads remote helper scripts before user code.
- `@resource`: Declares resources for `GM.getResourceText` and `GM.getResourceURL`.
- `@weight`: Controls execution order when multiple scripts match. Larger weights run first.

## Permissions

Declare every privileged API explicitly:

```js
// @grant GM.log
// @grant GM.getValue
// @grant GM.setValue
// @grant GM.xmlHttpRequest
// @grant GM.download
// @grant GM.cookie
// @grant Scripting.FileManager
```

Declare remote hosts with `@connect`:

```js
// @connect api.github.com
// @connect https://api.github.com/*
// @connect *
```

If a script uses `@grant none`, privileged GM APIs are disabled. `GM_info` and `GM.info` remain available for compatibility.

## Basic Template

```js
// ==UserScript==
// @name GitHub Helper
// @match https://github.com/*
// @run-at document-end
// @grant GM.log
// @grant GM.registerMenuCommand
// ==/UserScript==

GM.log("loaded", location.href)

GM.registerMenuCommand("Run helper", async () => {
  GM.log("clicked", {
    href: location.href,
    title: document.title
  })
})
```

## Common Patterns

### Add Page UI

Create page UI directly in the website when the user needs custom interaction:

```js
const button = document.createElement("button")
button.textContent = "Save page title"
button.style.position = "fixed"
button.style.right = "16px"
button.style.bottom = "16px"
button.style.zIndex = "2147483647"
button.onclick = async () => {
  await GM.setValue("lastTitle", document.title)
  GM.log("saved", document.title)
}
document.body.appendChild(button)
```

### Add Popup Menu Commands

Use `GM.registerMenuCommand` for user-triggered actions shown in Safari's extension popup:

```js
GM.registerMenuCommand("Download README", async () => {
  await GM.download({
    url: "https://raw.githubusercontent.com/user/repo/main/README.md",
    name: "README.md"
  })
})
```

### Store Values

```js
const count = await GM.getValue("count", 0)
await GM.setValue("count", count + 1)
GM.log("count", count + 1)
```

### Use Files

Use `Scripting.FileManager` for direct file access:

```js
// @grant Scripting.FileManager

const dir = Scripting.FileManager.safariBrowserDirectory
const file = `${dir}/notes.txt`
await Scripting.FileManager.writeAsString(file, `Saved from ${location.href}`)
const text = await Scripting.FileManager.readAsString(file)
GM.log("file", text)
```

Available Safari browser directories:

- `Scripting.FileManager.safariBrowserDirectory`
- `Scripting.FileManager.safariBrowserUserscriptsDirectory`
- `Scripting.FileManager.safariBrowserStorageDirectory`
- `Scripting.FileManager.safariBrowserDownloadsDirectory`

### Make Cross-Origin Requests

```js
// @grant GM.xmlHttpRequest
// @connect api.github.com

await GM.xmlHttpRequest({
  method: "GET",
  url: "https://api.github.com/zen",
  responseType: "text",
  onload(response) {
    GM.log("zen", response.status, response.responseText)
  }
})
```

## Compatibility Notes

- `GM.*` APIs and `Scripting.*` APIs require content-world execution.
- `@inject-into` defaults to `auto`: scripts with any `@grant` run in the content world; scripts with `@grant none` or no grant run in the page world (real page `window`). Use `@inject-into content` / `@inject-into page` to force a world. Grants are ignored in the page world.
- `GM_info` and `GM.info` expose metadata and runtime details.
- Both promise style and supported callback style can be used for compatible GM APIs.
- Installed userscripts can be enabled, disabled, updated, edited, or deleted from Safari Browser Scripts management surfaces.

# Testing Checklist

After creating or modifying a script:

- Confirm that `@match` or `@include` matches the target Safari page.
- Confirm that every privileged API has a matching `@grant`.
- Confirm that every remote host has a matching `@connect`.
- Refresh the Safari page and open the Scripting extension popup.
- Check that the script appears under matched scripts and that its toggle is enabled.
- Trigger menu commands from the popup if the script uses `GM.registerMenuCommand`.
- Review logs for permission errors, connect errors, parse errors, and completion messages.

# Important API References

Before using a GM API or Scripting API, query the Scripting documentation for `safari_browser_scripts` or the specific API symbol. The Safari browser scripts documentation includes the full metadata list, supported GM APIs, cookie behavior, XHR fields, FileManager directories, installed userscript storage, update behavior, and troubleshooting notes.

# Available Tools

When implementing this use case, you can use the following tools:

## scripting_reference (Query API Details)
Use the `scripting_reference` tool with `action: "query_apis"` to look up `safari_browser_scripts`, `GM`, `GM.xmlHttpRequest`, `GM.cookie`, `GM.download`, `GM.registerMenuCommand`, and `Scripting.FileManager` before generating final code.

## scripting-ts (Run Project Script)
When the target is `browser.tsx`, run `scripting-ts run <path>/browser.tsx` (via the `run_shell_command` tool) to execute it, or `scripting-ts project "<Script Name>"` to run the project entry.

## file_tool (Installed Userscript)
Use file tools to create or update `.user.js` files under the prompt-provided `safari_browser_userscripts_directory` when the target is an installed userscript.
