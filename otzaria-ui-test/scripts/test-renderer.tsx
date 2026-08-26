import { ScrollView, VStack, Text } from "scripting"

type TestRendererProps = {
  query?: string
  label?: string
}

/**
 * Minimal inline renderer, intentionally shaped like rich-maps:
 * - root ScrollView
 * - inner VStack
 * - simple Text nodes only
 * - no List / Section / Button
 * - no async / useEffect / database
 */
export default function OtzariaUiTestRenderer({ query, label }: TestRendererProps) {
  return (
    <ScrollView>
      <VStack spacing={12} padding={16}>
        <Text font="title2" fontWeight="bold">בדיקת אוצריא</Text>
        <Text>אם אתה רואה את הכרטיס הזה בתוך הצ׳אט — רינדור scripting-file עובד.</Text>
        <Text>תווית: {label || "בדיקת רינדור UI"}</Text>
        <Text>שאילתה: {query || "לא הועברה שאילתה"}</Text>
        <Text foregroundStyle="secondaryLabel">בדיקה זו משתמשת במבנה כמו rich-maps: ScrollView + VStack + Text בלבד.</Text>
      </VStack>
    </ScrollView>
  )
}
