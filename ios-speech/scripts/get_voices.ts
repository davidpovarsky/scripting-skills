import { Script } from "scripting"

const params = Script.queryParameters
const language = params.language as string | undefined
const quality = params.quality as string | undefined
const gender = params.gender as string | undefined

async function main() {
  try {
    let voices = await Speech.speechVoices
    const currentLanguage = await Speech.currentLanguageCode

    // Filter by language if specified
    if (language) {
      voices = voices.filter(v => 
        v.language.toLowerCase().includes(language.toLowerCase())
      )
    }

    // Filter by quality if specified
    if (quality) {
      const validQualities = ["default", "premium", "enhanced"]
      if (!validQualities.includes(quality)) {
        Script.exit({
          success: false,
          message: `Invalid quality: ${quality}. Use: ${validQualities.join(", ")}`
        })
        return
      }
      voices = voices.filter(v => v.quality === quality)
    }

    // Filter by gender if specified
    if (gender) {
      const validGenders = ["male", "female", "unspecified"]
      if (!validGenders.includes(gender)) {
        Script.exit({
          success: false,
          message: `Invalid gender: ${gender}. Use: ${validGenders.join(", ")}`
        })
        return
      }
      voices = voices.filter(v => v.gender === gender)
    }

    Script.exit({
      success: true,
      currentLanguage,
      count: voices.length,
      voices: voices.map(v => ({
        identifier: v.identifier,
        name: v.name,
        language: v.language,
        quality: v.quality,
        gender: v.gender
      }))
    })
  } catch (error: any) {
    Script.exit({ success: false, message: error.message ?? String(error) })
  }
}

main()
