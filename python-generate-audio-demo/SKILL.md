---
name: python-generate-audio-demo
description: Generate short audio WAV files using Python. Demonstrates how to use Python scripts in a skill.
runtime: python
entry: scripts/generate_tone.py
metadata:
  display_name: "Python Audio Generator"
  required_tools: "run_shell_command"
---

# Purpose

This is a demo skill showing how to use Python within the Scripting agent. It generates simple tone WAV files using only Python standard library modules (`wave`, `struct`, `math`).

# Usage

Execute via `run_shell_command`:

```
python3 <skill_dir>/scripts/generate_tone.py --frequency 440 --duration 2.0 --output /path/to/output.wav
```

**Parameters:**

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--frequency` | float | 440 | Tone frequency in Hz (e.g. 440 = A4 note) |
| `--duration` | float | 1.0 | Duration in seconds |
| `--output` | string | `tone.wav` | Output WAV file path |
| `--volume` | float | 0.8 | Volume from 0.0 to 1.0 |
| `--sample-rate` | int | 44100 | Sample rate in Hz |

**Output:** JSON object with `success`, `message`, `path`, `duration`, and `frequency` fields.

# Common Frequencies

| Note | Hz |
|------|----|
| C4 | 261.63 |
| D4 | 293.66 |
| E4 | 329.63 |
| F4 | 349.23 |
| G4 | 392.00 |
| A4 | 440.00 |
| B4 | 493.88 |
| C5 | 523.25 |

# Instructions

1. Determine the desired tone parameters from the user's request.
2. Build the command with appropriate flags.
3. Execute via `run_shell_command` with `python3 <path>`.
4. The output WAV file can be played back or attached to a response.
5. Ensure the output path is within an authorized file scope.
