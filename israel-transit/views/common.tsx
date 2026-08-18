import { HStack, VStack, Text, Spacer } from "scripting"
import { Departure, Line } from "./types"
import { formatArrivalHe } from "../scripts/lib/time"
export const lineNumber=(l:Line|any)=>String(l.lineNumber||l.routeNumber||l.route||"")
export function LineBadge({line,color}:{line:string;color?:string}){ return <VStack frame={{minWidth:34,height:30}} padding={{horizontal:7}} background={color||"systemBlue"} clipShape={{type:"rect",cornerRadius:8}} alignment="center"><Text font="subheadline" fontWeight="bold" foregroundStyle="white">{line}</Text></VStack> }
export function DepartureCard({d,compact=false}:{d:Departure;compact?:boolean;key?:string|number}){
  const live=d.realtime,clock=d.predictedTime||d.scheduledTime,label=formatArrivalHe(d.minutes,clock)
  if(compact) return <VStack spacing={0} padding={{horizontal:12,vertical:10}} frame={{minWidth:92,alignment:"center"}} background="systemGray6" clipShape={{type:"rect",cornerRadius:12}} alignment="center"><Text font="title3" fontWeight="bold" foregroundStyle={live?"systemGreen":"label"}>{label}</Text></VStack>
  return <VStack spacing={5} padding={10} frame={{width:150,alignment:"trailing"}} background="systemGray6" clipShape={{type:"rect",cornerRadius:14}} alignment="trailing"><HStack spacing={6}><Spacer/><Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1}>{d.destination||""}</Text><LineBadge line={d.lineNumber||"?"}/></HStack><Text font="title3" fontWeight="bold" foregroundStyle={live?"systemGreen":"label"}>{label}</Text>{d.minutes!==undefined&&d.minutes<60&&clock?<Text font="caption2" foregroundStyle="tertiaryLabel">{clock}</Text>:null}</VStack>
}
export function Empty({title,subtitle}:{title:string;subtitle?:string}){ return <VStack padding={20} spacing={6}><Text font="headline">{title}</Text>{subtitle?<Text font="footnote" foregroundStyle="secondaryLabel" multilineTextAlignment="center">{subtitle}</Text>:null}</VStack> }
