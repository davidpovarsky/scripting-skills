import { Script, Link, VStack, HStack, Text, Image, Spacer } from "scripting"
import type { View } from "scripting"

const skillDir = "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/interactive-picker-demo"

const selectionPath = skillDir + "/selection.json"

function ChoiceButton({ label, icon, value, color }: {
  label: string
  icon: string
  value: string
  color: string
}): View {
  // URL Scheme that runs a script to write the choice
  const url = Script.createOpenURLScheme("interactive-picker-select") +
    "?choice=" + encodeURIComponent(value) +
    "&path=" + encodeURIComponent(selectionPath)

  return (
    <Link url={url}>
      <HStack
        padding={16}
        background={color}
        cornerRadius={12}
      >
        <Image
          systemName={icon}
          width={28}
          height={28}
          foreground={"white"}
        />
        <Text
          font={"headline"}
          foreground={"white"}
        >
          {label}
        </Text>
      </HStack>
    </Link>
  )
}

function Content(): View {
  return (
    <VStack
      padding={20}
      spacing={16}
    >
      <VStack
        spacing={8}
        padding={{ bottom: 12 }}
      >
        <Image
          systemName={"hand.tap.fill"}
          width={40}
          height={40}
          foreground={"systemOrange"}
        />
        <Text
          font={"largeTitle"}
          foreground={"systemOrange"}
        >
          Interactive Picker
        </Text>
        <Text
          font={"subheadline"}
          foreground={"secondaryLabel"}
        >
          Tap an option below to make your choice.
          The selection will be saved and returned to the agent.
        </Text>
      </VStack>

      <ChoiceButton
        label={"🌴 חופשה בטבע"}
        icon={"leaf.fill"}
        value={"nature"}
        color={"systemGreen"}
      />
      <ChoiceButton
        label={"🏙️ חופשה בעיר"}
        icon={"building.2.fill"}
        value={"city"}
        color={"systemBlue"}
      />
      <ChoiceButton
        label={"🏖️ חופשה בים"}
        icon={"sun.max.fill"}
        value={"beach"}
        color={"systemTeal"}
      />
      <ChoiceButton
        label={"⛰️ חופשה בהרים"}
        icon={"mountain.2.fill"}
        value={"mountains"}
        color={"systemBrown"}
      />

      <Text
        font={"caption"}
        foreground={"tertiaryLabel"}
        alignment={"center"}
      >
        This is an interactive skill demo — your tap writes to a file,
        then the agent reads it and continues.
      </Text>
    </VStack>
  )
}

export default Content
