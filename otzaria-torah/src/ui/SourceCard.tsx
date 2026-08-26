import { VStack, Text } from "scripting"

export type SourceCardProps = {
  key?: string
  bookTitle: string
  heRef?: string | null
  text: string
  connectionType?: string | null
}

export function SourceCard({ bookTitle, heRef, text, connectionType }: SourceCardProps) {
  return (
    <VStack spacing={6} padding={12} background="systemGray6" clipShape={{ type: "rect", cornerRadius: 12 }}>
      <Text font="subheadline" fontWeight="semibold" foregroundStyle="label">{bookTitle}</Text>
      {heRef ? <Text font="caption" foregroundStyle="secondaryLabel">{heRef}</Text> : null}
      {connectionType ? <Text font="caption" foregroundStyle="secondaryLabel">סוג קשר: {connectionType}</Text> : null}
      <Text font="body" foregroundStyle="label">{text}</Text>
    </VStack>
  )
}
