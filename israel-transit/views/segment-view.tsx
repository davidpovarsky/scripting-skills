import { VStack,HStack,Text,Image,Spacer } from "scripting"
import { decodeDisplayText } from "../scripts/lib/normalize"
import { formatClock,formatMinutesHe,isoToMs } from "../scripts/lib/time"
import { Stop } from "./types"

type LiveStat={durationMinutes:number;vehicleId?:string;tripId?:string;fromEta?:string;toEta?:string;lastReported?:string}
type ActualStat={durationMinutes:number;vehicleId?:string;tripId?:string;fromTime?:string;toTime?:string;completedAt?:number;precisionSeconds?:number}
type ScheduledStat={durationMinutes:number;tripId?:string;departureTime?:string;basis?:string}
type Props={lineNumber?:string;fromStop:Stop;toStop:Stop;durationMinutes:number;minMinutes?:number;maxMinutes?:number;stopCount?:number;date?:string;headsign?:string;source?:string;currentLive?:LiveStat;recentActual?:ActualStat[];recentActualMedianMinutes?:number;scheduled?:ScheduledStat;historyCollecting?:boolean}

function clock(value?:string){return formatClock(isoToMs(value))||"—"}
function scheduleBasis(value?:string){return value==="same_trip"?"אותה נסיעה":value==="nearest_trip"?"הנסיעה המתוכננת הקרובה":value==="daily_median"?"חציון לוח היום":value==="directions_fallback"?"תכנון מסלול":"לוח זמנים"}

export default function SegmentView(p:Props){
  const actual=(p.recentActual||[]).slice(0,3)
  const actualText=actual.map(x=>Math.round(x.durationMinutes)).join(" · ")
  const diff=p.currentLive&&p.scheduled?Math.round(p.currentLive.durationMinutes-p.scheduled.durationMinutes):undefined
  const precision=actual.length?Math.max(...actual.map(x=>Number(x.precisionSeconds||0))):0
  return <VStack spacing={10} padding={14} alignment="trailing">
    <HStack><Image systemName="bus.fill" foregroundStyle="systemBlue"/><Text font="headline" fontWeight="bold">קו {p.lineNumber||""}</Text><Spacer/>{p.headsign?<Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1}>{decodeDisplayText(p.headsign)}</Text>:null}</HStack>
    <VStack spacing={2} alignment="trailing">
      <Text font="subheadline" fontWeight="semibold">{decodeDisplayText(p.fromStop.name)} ← {decodeDisplayText(p.toStop.name)}</Text>
      <HStack><Spacer/>{p.stopCount?<Text font="caption2" foregroundStyle="tertiaryLabel">{p.stopCount} תחנות</Text>:null}</HStack>
    </VStack>

    <VStack spacing={5} padding={11} background="systemGray6" clipShape={{type:"rect",cornerRadius:14}} alignment="trailing">
      <HStack><Image systemName="dot.radiowaves.left.and.right" foregroundStyle="systemGreen"/><Text font="subheadline" fontWeight="semibold">עכשיו · אותו אוטובוס בזמן אמת</Text><Spacer/></HStack>
      {p.currentLive?<>
        <Text font="title2" fontWeight="bold" foregroundStyle="systemGreen">{formatMinutesHe(p.currentLive.durationMinutes,"0 דק׳")}</Text>
        <Text font="caption" foregroundStyle="secondaryLabel">ETA {clock(p.currentLive.fromEta)} → {clock(p.currentLive.toEta)}{p.currentLive.vehicleId?` · רכב ${p.currentLive.vehicleId}`:""}</Text>
      </>:<Text font="subheadline" foregroundStyle="secondaryLabel">אין כרגע רכב חי שעבורו קיימת ETA לשתי התחנות.</Text>}
    </VStack>

    <VStack spacing={5} padding={11} background="systemGray6" clipShape={{type:"rect",cornerRadius:14}} alignment="trailing">
      <HStack><Image systemName="clock.arrow.circlepath" foregroundStyle="systemBlue"/><Text font="subheadline" fontWeight="semibold">3 נסיעות אחרונות שנמדדו בפועל</Text><Spacer/></HStack>
      {actual.length?<>
        <Text font="title3" fontWeight="bold">חציון {formatMinutesHe(p.recentActualMedianMinutes,"0 דק׳")}</Text>
        <Text font="caption" foregroundStyle="secondaryLabel">{actualText} דק׳ · {actual.length}/3 נסיעות</Text>
        {precision?<Text font="caption2" foregroundStyle="tertiaryLabel">נמדד מתצפיות realtime על אותו trip/vehicle · דיוק של עד כ־{precision} שנ׳</Text>:null}
      </>:<>
        <Text font="subheadline" foregroundStyle="secondaryLabel">עדיין אין 3 נסיעות שנמדדו מקצה לקצה.</Text>
        {p.historyCollecting?<Text font="caption2" foregroundStyle="tertiaryLabel">האיסוף המקומי פעיל כעת ויצבור נסיעות שעוברות בשתי התחנות.</Text>:null}
      </>}
    </VStack>

    <VStack spacing={5} padding={11} background="systemGray6" clipShape={{type:"rect",cornerRadius:14}} alignment="trailing">
      <HStack><Image systemName="calendar" foregroundStyle="systemOrange"/><Text font="subheadline" fontWeight="semibold">לפי לוח הזמנים המתוכנן</Text><Spacer/></HStack>
      {p.scheduled?<>
        <Text font="title3" fontWeight="bold">{formatMinutesHe(p.scheduled.durationMinutes,"0 דק׳")}</Text>
        <Text font="caption" foregroundStyle="secondaryLabel">{scheduleBasis(p.scheduled.basis)}{p.scheduled.departureTime?` · יציאה ${clock(p.scheduled.departureTime)}`:""}</Text>
      </>:<Text font="subheadline" foregroundStyle="secondaryLabel">אין נתון מתוכנן זמין לקטע הזה.</Text>}
    </VStack>

    {diff!==undefined&&diff!==0?<Text font="caption" foregroundStyle={diff>0?"systemOrange":"systemGreen"}>כרגע {diff>0?`איטי בכ־${diff}`:`מהיר בכ־${Math.abs(diff)}`} דק׳ לעומת המתוכנן</Text>:null}
    <Text font="caption2" foregroundStyle="tertiaryLabel">זמן אמת והיסטוריה: KavNav · תכנון: KavNav schedule{p.date?` · ${p.date}`:""}</Text>
  </VStack>
}
