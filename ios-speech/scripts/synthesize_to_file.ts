import { Script, Path } from "scripting"

const params = Script.queryParameters
const text = params.text as string
const filename = params.filename as string | undefined
const rate = params.rate !== undefined ? Number(params.rate) : undefined
const pitch = params.pitch !== undefined ? Number(params.pitch) : undefined
const volume = params.volume !== undefined ? Number(params.volume) : undefined
const voiceIdentifier = params.voice_identifier as string | undefined
const voiceLanguage = params.voice_language as string | undefined
const isMarkdown = params.is_markdown === "true"

async function main() {
  if (!text) {
    Script.exit({ success: false, message: "Missing required parameter: text" })
    return
  }

  try {
    // Initialize audio session for speech synthesis
    await SharedAudioSession.setCategory("playback", [])
    await SharedAudioSession.setMode("voicePrompt")
    await SharedAudioSession.setActive(true)

    const options: SpeechSynthesisOptions = {}
    
    if (rate !== undefined) options.rate = rate
    if (pitch !== undefined) options.pitch = pitch
    if (volume !== undefined) options.volume = volume
    if (voiceIdentifier) options.voiceIdentifier = voiceIdentifier
    if (voiceLanguage) options.voiceLanguage = voiceLanguage
    if (isMarkdown) options.isMarkdown = true

    const outputFilename = filename ?? `speech_${Date.now()}.caf`
    const filePath = Path.join(FileManager.documentsDirectory, outputFilename)

    await Speech.synthesizeToFile(text, filePath, options)

    Script.exit({
      success: true,
      message: `Audio saved to: ${outputFilename}`,
      filePath
    })
  } catch (error: any) {
    Script.exit({ success: false, message: error.message ?? String(error) })
  }
}

main()
