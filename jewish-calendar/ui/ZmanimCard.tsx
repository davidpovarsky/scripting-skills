import { VStack, HStack, ZStack, Text, Image, Spacer, ScrollView, Divider, ProgressView, RoundedRectangle } from "scripting"
import type { Color } from "scripting"

export type DayData = {
  date: string
  weekday: string
  hebrew: string
  parasha?: string | null
  daf?: string | null
  zmanim: Record<string, number>
  candles?: number | null
  havdalah?: number | null
  rt?: number | null
  events?: string[]
  omer?: number | null
}

export type CardProps = {
  place?: string
  days?: DayData[]
}

type HexColor = `#${string}`

const fmt = (m: number): string => {
  const h = Math.floor(m / 60)
  const mm = m % 60
  const hs = h < 10 ? "0" + h : "" + h
  const ms = mm < 10 ? "0" + mm : "" + mm
  return hs + ":" + ms
}

function iconFor(label: string): { icon: string; color: HexColor } {
  if (label.indexOf("עלות") >= 0) return { icon: "moon.stars.fill", color: "#5856D9" }
  if (label.indexOf("משיכיר") >= 0) return { icon: "star.circle.fill", color: "#5E5CE6" }
  if (label.indexOf("נץ") >= 0) return { icon: "sunrise.fill", color: "#FF9500" }
  if (label.indexOf('ק״ש') >= 0 && label.indexOf("מג״א") >= 0) return { icon: "book.closed.fill", color: "#34C759" }
  if (label.indexOf('ק״ש') >= 0) return { icon: "book.closed.fill", color: "#30B0C7" }
  if (label.indexOf("תפילה") >= 0 && label.indexOf("מג״א") >= 0) return { icon: "hands.sparkles.fill", color: "#AF52DE" }
  if (label.indexOf("תפילה") >= 0) return { icon: "hands.sparkles.fill", color: "#BF5AF2" }
  if (label.indexOf("חצות") >= 0) return { icon: "sun.max.fill", color: "#FFCC00" }
  if (label.indexOf("גדולה") >= 0) return { icon: "cloud.sun.fill", color: "#FF9F0A" }
  if (label.indexOf("קטנה") >= 0) return { icon: "haze.sun.fill", color: "#FF9500" }
  if (label.indexOf("פלג") >= 0) return { icon: "sun.and.horizon.fill", color: "#FF8C42" }
  if (label.indexOf("שקיעה") >= 0) return { icon: "sunset.fill", color: "#FF6482" }
  if (label.indexOf("צאת") >= 0) return { icon: "moon.stars.fill", color: "#5E5CE6" }
  if (label.indexOf('ר״ת') >= 0) return { icon: "sparkles", color: "#BF5AF2" }
  return { icon: "clock.fill", color: "#8E8E93" }
}

function sectionOf(label: string): number {
  if (/עלות|משיכיר|נץ|שמע|תפילה/.test(label)) return 0
  if (/חצות|מנחה|פלג/.test(label)) return 1
  return 2
}

const SECTION_META: Array<{ title: string; icon: string; color: HexColor }> = [
  { title: "בוקר", icon: "sun.max.fill", color: "#FF9500" },
  { title: "אחה״צ", icon: "sun.horizon.fill", color: "#FF6482" },
  { title: "לילה", icon: "moon.stars.fill", color: "#5E5CE6" },
]

const PANEL_BG: { light: Color; dark: Color } = { light: "#F5F5F7", dark: "#1C1C1E" }

function ZmanRow(props: { label: string; value: number }) {
  const ic = iconFor(props.label)
  return (
    <HStack alignment={"center"} spacing={10}>
      <Image systemName={ic.icon} foregroundStyle={ic.color} font={17} frame={{ width: 26 }} />
      <Text font={"subheadline"}>{props.label}</Text>
      <Spacer />
      <Text font={{ name: "Menlo", size: 16 }} fontWeight={"semibold"}>{fmt(props.value)}</Text>
    </HStack>
  )
}

function Section(props: { index: number; entries: Array<[string, number]> }) {
  const meta = SECTION_META[props.index]
  return (
    <VStack alignment={"leading"} spacing={6}>
      <HStack spacing={6}>
        <Image systemName={meta.icon} foregroundStyle={meta.color} font={13} />
        <Text font={"caption"} fontWeight={"bold"} foregroundStyle={meta.color}>{meta.title}</Text>
      </HStack>
      <VStack spacing={2}>
        {props.entries.map(function (e) {
          return <ZmanRow key={e[0]} label={e[0]} value={e[1]} />
        })}
      </VStack>
    </VStack>
  )
}

function Chip(props: { icon: string; color: HexColor; tint: Color; text: string }) {
  return (
    <HStack spacing={5} padding={{ top: 6, bottom: 6, leading: 10, trailing: 10 }}
      background={<RoundedRectangle cornerRadius={999} fill={props.tint} opacity={0.15} />}>
      <Image systemName={props.icon} foregroundStyle={props.color} font={11} />
      <Text font={"footnote"} fontWeight={"semibold"} foregroundStyle={props.color}>{props.text}</Text>
    </HStack>
  )
}

function ShabbatHero(props: { parasha?: string | null; candles?: number | null; havdalah?: number | null; rt?: number | null }) {
  return (
    <VStack spacing={10} padding={16}
      background={<RoundedRectangle cornerRadius={20} fill={{ colors: ["#FF8A56", "#FF5E78"], startPoint: "topLeading", endPoint: "bottomTrailing" }} />}>
      {props.parasha ? (
        <HStack spacing={6}>
          <Image systemName="book.open.fill" foregroundStyle={"#FFFFFF"} font={13} />
          <Text font={"headline"} foregroundStyle={"#FFFFFF"}>{"פרשת " + props.parasha}</Text>
        </HStack>
      ) : null}
      <HStack alignment={"center"} spacing={0}>
        <VStack alignment={"center"} spacing={3} frame={{ maxWidth: "infinity" }}>
          <Image systemName="sparkles" foregroundStyle={"#FFFFFF"} font={14} />
          <Text font={"caption"} foregroundStyle={"rgba(255,255,255,0.85)"}>הדלקת נרות</Text>
          <Text font={"title2"} fontWeight={"bold"} foregroundStyle={"#FFFFFF"}>
            {props.candles != null ? fmt(props.candles) : "—"}
          </Text>
        </VStack>
        <VStack frame={{ width: 1, height: 46 }} background={"white"} opacity={0.4} />
        <VStack alignment={"center"} spacing={3} frame={{ maxWidth: "infinity" }}>
          <Image systemName="moon.stars.fill" foregroundStyle={"#FFFFFF"} font={14} />
          <Text font={"caption"} foregroundStyle={"rgba(255,255,255,0.85)"}>מוצאי שבת</Text>
          <Text font={"title2"} fontWeight={"bold"} foregroundStyle={"#FFFFFF"}>
            {props.havdalah != null ? fmt(props.havdalah) : "—"}
          </Text>
        </VStack>
      </HStack>
      {props.rt != null ? (
        <Text font={"caption2"} foregroundStyle={"rgba(255,255,255,0.7)"}>
          {"ליל ר״ת (72 דק׳): " + fmt(props.rt)}
        </Text>
      ) : null}
    </VStack>
  )
}

function OmerBanner(props: { day: number }) {
  return (
    <HStack spacing={12} padding={12} background={<RoundedRectangle cornerRadius={16} fill="systemGreen" opacity={0.16} />}>
      <ProgressView value={props.day} total={49} progressViewStyle={"circular"} frame={{ width: 38, height: 38 }} />
      <VStack alignment={"leading"} spacing={2}>
        <Text font={"subheadline"} fontWeight={"semibold"}>{"יום " + props.day + " לעומר"}</Text>
        <Text font={"caption2"} foregroundStyle={"secondaryLabel"}>{49 - props.day + " ימים לשבועות"}</Text>
      </VStack>
      <Spacer />
      <Image systemName="wheat" foregroundStyle={"#34C759"} font={22} />
    </HStack>
  )
}

function DayCard(props: { day: DayData; place: string }) {
  const d = props.day
  const hebrewShort = d.hebrew.replace(/\s*\(\d+\)\s*$/, "")
  const keys = Object.keys(d.zmanim || {})
  const groups: Array<Array<[string, number]>> = [[], [], []]
  keys.forEach(function (k) { groups[sectionOf(k)].push([k, d.zmanim[k]]) })
  const evs = d.events || []
  const isShabbatCard = d.candles != null || d.havdalah != null
  return (
    <VStack alignment={"leading"} spacing={12}>
      {/* Header */}
      <HStack alignment={"center"} spacing={10}>
        <ZStack frame={{ width: 44, height: 44 }}>
          <RoundedRectangle cornerRadius={22} fill={{ colors: ["#FFB75E", "#ED8F03"], startPoint: "top", endPoint: "bottom" }} />
          <Image systemName="sun.horizon.fill" foregroundStyle={"#FFFFFF"} font={21} />
        </ZStack>
        <VStack alignment={"leading"} spacing={1}>
          <Text font={"headline"}>{props.place}</Text>
          <Text font={"footnote"} foregroundStyle={"secondaryLabel"}>
            {"יום " + d.weekday + " · " + d.date}
          </Text>
        </VStack>
        <Spacer />
        <Chip icon="calendar" color="#5856D9" tint="systemPurple" text={hebrewShort} />
      </HStack>

      {/* Shabbat hero */}
      {isShabbatCard ? (
        <ShabbatHero parasha={d.parasha} candles={d.candles} havdalah={d.havdalah} rt={d.rt} />
      ) : null}

      {/* Events */}
      {evs.length > 0 ? (
        <HStack spacing={8} padding={12} background={<RoundedRectangle cornerRadius={16} fill="systemOrange" opacity={0.16} />}>
          <Image systemName="party.popper.fill" foregroundStyle={"#FF9500"} font={18} />
          <Text font={"subheadline"} fontWeight={"semibold"} foregroundStyle={"#C25E00"}>
            {evs.join("  ·  ")}
          </Text>
          <Spacer />
        </HStack>
      ) : null}

      {/* Parasha + Daf */}
      {(d.parasha && !isShabbatCard) || d.daf ? (
        <HStack spacing={8}>
          {d.parasha && !isShabbatCard ? (
            <Chip icon="book.open.fill" color="#007AFF" tint="systemBlue" text={"פרשת " + d.parasha} />
          ) : null}
          {d.daf ? <Chip icon="scroll.fill" color="#34A700" tint="systemGreen" text={"דף יומי: " + d.daf} /> : null}
          <Spacer />
        </HStack>
      ) : null}

      {/* Zmanim panels */}
      {groups.map(function (g, i) {
        if (g.length === 0) return null
        return (
          <VStack key={"sec" + i} alignment={"leading"} spacing={8} padding={14}
            background={<RoundedRectangle cornerRadius={18} fill={PANEL_BG} />}>
            <Section index={i} entries={g} />
          </VStack>
        )
      })}

      {/* Omer */}
      {d.omer ? <OmerBanner day={d.omer} /> : null}
    </VStack>
  )
}

export default function JewishCalendarCards(props: CardProps) {
  const days = props.days || []
  const place = props.place || "ירושלים"
  return (
    <ScrollView>
      <VStack spacing={22} padding={16}>
        {days.map(function (d, i) {
          return (
            <VStack key={"day" + i} spacing={22}>
              <DayCard day={d} place={place} />
              {i < days.length - 1 ? <Divider /> : null}
            </VStack>
          )
        })}
      </VStack>
    </ScrollView>
  )
}
