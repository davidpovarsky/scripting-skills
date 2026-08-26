# Otzaria Torah Skill Bundle v2.3.1

Place this folder directly in:

`/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/otzaria-torah`

This is a self-contained Scripting Skill bundle. It has no `index.tsx` installer and no external project dependency for UI rendering.

The inline chat UI uses the same rendering shape that worked in the `otzaria-ui-test` and `rich-maps` checks:

- root `ScrollView`
- inner `VStack`
- compact `Text` cards
- no `List`
- no `Section`

Runtime files:

- `scripts/otzaria-live-search.tsx` for live search UI
- `scripts/otzaria-renderer.tsx` for normal source/context/link UI
- `src/ui/*` rewritten for inline chat rendering

The UI scripts fetch results directly from the local `seforim.db`. The model should pass only tiny props such as `action`, `query`, and `limit`.
