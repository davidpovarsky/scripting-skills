#!/usr/bin/env python3
"""Generate a sine wave WAV file using only Python standard library."""

import argparse
import json
import math
import struct
import wave
import sys
import os


def generate_tone(frequency, duration, output_path, volume=0.8, sample_rate=44100):
    """Generate a sine wave and write it as a WAV file."""
    num_samples = int(sample_rate * duration)
    amplitude = int(32767 * max(0.0, min(1.0, volume)))

    samples = []
    for i in range(num_samples):
        t = i / sample_rate
        value = int(amplitude * math.sin(2 * math.pi * frequency * t))
        samples.append(struct.pack("<h", value))

    # Ensure output directory exists
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    with wave.open(output_path, "w") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(b"".join(samples))

    return output_path


def main():
    parser = argparse.ArgumentParser(description="Generate a tone WAV file.")
    parser.add_argument("--frequency", type=float, default=440.0, help="Frequency in Hz")
    parser.add_argument("--duration", type=float, default=1.0, help="Duration in seconds")
    parser.add_argument("--output", type=str, default="tone.wav", help="Output file path")
    parser.add_argument("--volume", type=float, default=0.8, help="Volume 0.0-1.0")
    parser.add_argument("--sample-rate", type=int, default=44100, help="Sample rate in Hz")
    args = parser.parse_args()

    if args.frequency <= 0:
        print(json.dumps({"success": False, "message": "Frequency must be positive."}))
        sys.exit(1)

    if args.duration <= 0 or args.duration > 30:
        print(json.dumps({"success": False, "message": "Duration must be between 0 and 30 seconds."}))
        sys.exit(1)

    try:
        path = generate_tone(
            frequency=args.frequency,
            duration=args.duration,
            output_path=args.output,
            volume=args.volume,
            sample_rate=args.sample_rate,
        )
        file_size = os.path.getsize(path)
        print(json.dumps({
            "success": True,
            "message": f"Generated {args.duration}s tone at {args.frequency}Hz",
            "path": os.path.abspath(path),
            "frequency": args.frequency,
            "duration": args.duration,
            "file_size": file_size,
        }))
    except Exception as e:
        print(json.dumps({"success": False, "message": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
