import { VStack, Text } from "scripting"

export type WorkflowStep = {
  title: string
  detail: string
}

export function WorkflowList({ steps }: { steps: WorkflowStep[] }) {
  return (
    <VStack spacing={6} padding={12} background="systemGray6" clipShape={{ type: "rect", cornerRadius: 12 }}>
      <Text font="headline" fontWeight="semibold">תהליך עבודה</Text>
      {steps.map((step, index) =>
        <Text key={`${index}-${step.title}`} font="caption" foregroundStyle="secondaryLabel">
          {index + 1}. {step.title} — {step.detail}
        </Text>
      )}
    </VStack>
  )
}
