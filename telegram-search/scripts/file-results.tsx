import { Button, HStack, Image, Script, Spacer, Text, VStack, ZStack } from "scripting"

type TelegramFileCardItem = {
  filePath: string
  name?: string | null
  size?: number | null
  mimeType?: string | null
  ext?: string | null
  kind?: string | null
  messageId?: string | null
}

type TelegramFileResultsProps = {
  files?: TelegramFileCardItem[]
}

const QuickLookAPI = (globalThis as any).QuickLook

function fileNameFromPath(filePath: string): string {
  const normalized = String(filePath || "").replaceAll("\\", "/")
  return normalized.split("/").filter(Boolean).pop() || "File"
}

function normalizedExtension(file: TelegramFileCardItem): string {
  const explicit = String(file.ext || "").trim().toLowerCase().replace(/^\./, "")
  if (explicit) return explicit
  const name = String(file.name || fileNameFromPath(file.filePath))
  const dot = name.lastIndexOf(".")
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ""
}

function symbolForFile(file: TelegramFileCardItem): string {
  const ext = normalizedExtension(file)
  const mime = String(file.mimeType || "").toLowerCase()
  const kind = String(file.kind || "").toLowerCase()

  if (["epub", "mobi", "azw", "azw3", "fb2", "djvu"].includes(ext)) return "book.closed.fill"
  if (ext === "pdf") return "doc.richtext.fill"
  if (kind === "photo" || kind === "image" || mime.startsWith("image/") || ["jpg", "jpeg", "png", "heic", "heif", "webp", "gif", "tif", "tiff", "bmp"].includes(ext)) return "photo.fill"
  if (kind === "video" || mime.startsWith("video/") || ["mp4", "mov", "m4v", "avi", "mkv", "webm", "3gp"].includes(ext)) return "play.rectangle.fill"
  if (kind === "audio" || mime.startsWith("audio/") || ["mp3", "m4a", "aac", "wav", "flac", "ogg", "opus", "aiff", "alac"].includes(ext)) return "waveform"
  if (["zip", "rar", "7z", "tar", "gz", "bz2", "xz"].includes(ext)) return "archivebox.fill"
  if (["doc", "docx", "pages", "rtf", "odt"].includes(ext)) return "doc.text.fill"
  if (["xls", "xlsx", "numbers", "csv", "ods"].includes(ext)) return "tablecells.fill"
  if (["ppt", "pptx", "key", "odp"].includes(ext)) return "rectangle.on.rectangle.angled"
  if (["txt", "md", "markdown", "log"].includes(ext)) return "doc.plaintext.fill"
  if (["js", "jsx", "ts", "tsx", "py", "swift", "html", "htm", "xml", "json", "yaml", "yml", "css"].includes(ext)) return "chevron.left.forwardslash.chevron.right"
  return "doc.fill"
}

async function openFile(file: TelegramFileCardItem) {
  try {
    const raw = await Script.run<any>({
      name: "telrgram api",
      queryParameters: {
        agentAction: "preview_local_file",
        action: "preview_local_file",
        path: file.filePath,
      },
      singleMode: false,
    })

    const result = typeof raw === "string" ? (() => {
      try { return JSON.parse(raw) } catch { return null }
    })() : raw

    if (result?.ok) return
  } catch {}

  try {
    if (QuickLookAPI?.previewURLs) await QuickLookAPI.previewURLs([file.filePath])
  } catch (error: any) {
    console.error(`[telegram-file-card] Failed to open ${file.filePath}: ${error?.message || String(error)}`)
  }
}

function FileTypeIcon({ file }: { file: TelegramFileCardItem }) {
  return (
    <ZStack
      frame={{ width: 34, height: 34, alignment: "center" }}
      background="systemGray"
      clipShape={{ type: "rect", cornerRadius: 8, style: "continuous" }}
    >
      <Image
        systemName={symbolForFile(file)}
        fontSize={17}
        foregroundColor="white"
      />
    </ZStack>
  )
}

function AttachmentCard({ file }: { file: TelegramFileCardItem }) {
  const name = String(file.name || fileNameFromPath(file.filePath))

  return (
    <Button
      action={() => { void openFile(file) }}
      buttonStyle="plain"
      frame={{ maxWidth: "infinity" }}
    >
      <HStack
        spacing={12}
        padding={{ vertical: 12, horizontal: 14 }}
        frame={{ maxWidth: "infinity", minHeight: 58, alignment: "center" }}
        background="systemGray6"
        clipShape={{ type: "rect", cornerRadius: 20, style: "continuous" }}
      >
        <FileTypeIcon file={file} />
        <Text
          fontSize={16}
          fontWeight="medium"
          lineLimit={1}
          frame={{ maxWidth: "infinity", alignment: "leading" }}
        >
          {name}
        </Text>
        <Spacer />
        <Image systemName="chevron.right" fontSize={15} foregroundColor="secondary" />
      </HStack>
    </Button>
  )
}

export default function TelegramFileResults({ files = [] }: TelegramFileResultsProps) {
  const validFiles = Array.isArray(files)
    ? files.filter((file) => file && typeof file.filePath === "string" && file.filePath.length > 0)
    : []

  if (validFiles.length === 0) {
    return <Text foregroundColor="secondary">No file is available to open.</Text>
  }

  return (
    <VStack spacing={8} frame={{ maxWidth: "infinity" }}>
      {validFiles.map((file) => <AttachmentCard file={file} />)}
    </VStack>
  )
}
