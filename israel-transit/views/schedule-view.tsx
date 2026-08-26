import { VStack,HStack,Text,Image,Spacer,DatePicker,useState } from "scripting"
import { stopSchedule,routeSchedule } from "../scripts/lib/kavnav"
import { scheduleTrips } from "../scripts/lib/normalize"
import { scheduleMs,todayJerusalem } from "../scripts/lib/time"
import { LineBadge,Empty } from "./common"
import { InlineLoadingIndicator } from "./loading-view"

type Mode="schedule"|"last"|"first"
type Props={scope:"stop"|"line"|"nearby-line";title?:string;date:string;trips:any[];stopCode?:string;routeId?:string;routeIds?:string[];lineNumber?:string;directionLabel?:string;routes?:any[];minDate?:string;maxDate?:string;mode?:Mode}
const H={schedule:"לוח זמנים",date:"תאריך",trips:"נסיעות",last:"האחרון",first:"הראשון",failed:"לא ניתן לטעון את לוח הזמנים",none:"אין נסיעות בתאריך שנבחר"}
const dateString=(ms:number)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jerusalem",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms))
const dateMs=(date?:string)=>date?new Date(`${date}T12:00:00+03:00`).getTime():undefined
const timeMs=(t:any,date:string)=>scheduleMs(t.operationalDate||date,t.departureTime||t.originDepartureTime)
const sortTrips=(xs:any[],date:string)=>[...xs].sort((a,b)=>(timeMs(a,date)??Number.MAX_SAFE_INTEGER)-(timeMs(b,date)??Number.MAX_SAFE_INTEGER))
function routeNumber(routes:any[]|undefined,routeId:any,fallback?:string){const r=(routes||[]).find(x=>String(x.routeId)===String(routeId));return String(r?.routeNumber||fallback||"")}
function displayTime(value:any){const raw=String(value||"—"),m=raw.match(/^(\d+):(\d{2})/);if(!m)return raw;const h=Number(m[1]),hh=String(h%24).padStart(2,"0"),suffix=h>=24?" למחרת":"";return `${hh}:${m[2]}${suffix}`}
function applyMode(xs:any[],date:string,mode:Mode){const sorted=sortTrips(xs,date);if(mode==="last")return sorted.length?[sorted[sorted.length-1]]:[];if(mode==="first")return sorted.slice(0,1);return sorted}
function chunks<T>(xs:T[],size:number):T[][]{const out:T[][]=[];for(let i=0;i<xs.length;i+=size)out.push(xs.slice(i,i+size));return out}
export default function ScheduleView(props:Props){
  const [selectedDate,setSelectedDate]=useState(props.date),[shown,setShown]=useState(applyMode(props.trips,props.date,props.mode||"schedule")),[loading,setLoading]=useState(false),[error,setError]=useState<string|undefined>(undefined)
  const mode=props.mode||"schedule",routeSet=new Set((props.routeIds||[]).map(String))
  const load=async(ms:number)=>{const next=dateString(ms);if(next===selectedDate)return;setSelectedDate(next);setLoading(true);setError(undefined);try{let xs:any[]=[];if(props.scope==="line"&&props.routeId){const raw=await routeSchedule(props.routeId,next);xs=raw.trips||[]}else if(props.stopCode){const raw=await stopSchedule(props.stopCode,next);xs=scheduleTrips(raw);if(routeSet.size)xs=xs.filter(t=>routeSet.has(String(t.routeId)))}setShown(applyMode(xs,next,mode))}catch(e){setShown([]);setError(e instanceof Error?e.message:String(e))}finally{setLoading(false)}}
  const today=todayJerusalem(),now=Date.now(),heading=mode==="last"?H.last:mode==="first"?H.first:H.schedule
  const lineSpecific=props.scope==="line"||props.scope==="nearby-line"||!!props.lineNumber||routeSet.size>0
  const visible=shown.slice(0,300),nextIndex=selectedDate===today?visible.findIndex(t=>{const ms=timeMs(t,selectedDate);return ms!==undefined&&ms>=now}):-1
  const rows=chunks(visible.map((t:any,i:number)=>({t,i})),3)
  return <VStack spacing={0}>
    <HStack padding={{horizontal:14,top:10,bottom:6}}><Image systemName="calendar" foregroundStyle="systemBlue"/><VStack alignment="trailing" spacing={2}><Text font="headline" fontWeight="bold">{props.title||H.schedule}</Text><Text font="caption" foregroundStyle="secondaryLabel">{props.directionLabel?`${props.directionLabel} · `:""}{heading} · {shown.length} {H.trips}</Text></VStack><Spacer/></HStack>
    <HStack padding={{horizontal:14,bottom:8}}><DatePicker title={H.date} value={dateMs(selectedDate)||Date.now()} onChanged={(v)=>{void load(v)}} startDate={dateMs(props.minDate)} endDate={dateMs(props.maxDate)} displayedComponents={["date"]} datePickerStyle="compact"/><Spacer/>{loading?<InlineLoadingIndicator kind="schedule" text="מעדכן נסיעות לתאריך שנבחר"/>:null}</HStack>
    {error?<Text padding={{horizontal:14,bottom:8}} font="caption" foregroundStyle="systemRed">{H.failed}</Text>:null}
    {!shown.length?<Empty title={H.none}/>:lineSpecific?<VStack spacing={6} padding={{horizontal:12,bottom:14}}>{rows.map((row,ri)=><HStack key={String(ri)} spacing={6}>{row.map(({t,i})=>{const ms=timeMs(t,selectedDate),passed=selectedDate===today&&ms!==undefined&&ms<now,isNext=i===nextIndex,clock=displayTime(t.departureTime||t.originDepartureTime);return <VStack key={t.tripId||`${ri}-${i}`} frame={{width:98,height:42}} padding={{horizontal:6,vertical:5}} background={isNext?"systemGray5":"systemGray6"} clipShape={{type:"rect",cornerRadius:9}} alignment="center"><Text font="subheadline" fontWeight={isNext?"bold":"semibold"} foregroundStyle={passed?"tertiaryLabel":"label"}>{clock}</Text></VStack>})}{row.length<3?Array.from({length:3-row.length}).map((_,j)=><VStack key={`blank-${ri}-${j}`} frame={{width:98,height:1}}/>):null}</HStack>)}</VStack>:<VStack spacing={2} padding={{horizontal:12,bottom:14}}>{visible.map((t:any,i:number)=>{const ms=timeMs(t,selectedDate),passed=selectedDate===today&&ms!==undefined&&ms<now,line=routeNumber(props.routes,t.routeId,props.lineNumber),clock=displayTime(t.departureTime||t.originDepartureTime);return <HStack key={t.tripId||String(i)} spacing={8} padding={{horizontal:8,vertical:6}} background={i%2===0?"systemGray6":"systemBackground"} clipShape={{type:"rect",cornerRadius:8}}><Text font="subheadline" fontWeight="semibold" foregroundStyle={passed?"tertiaryLabel":"label"}>{clock}</Text><Text font="caption" foregroundStyle={passed?"tertiaryLabel":"secondaryLabel"} lineLimit={1}>{t.headsign||""}</Text><Spacer/>{line?<LineBadge line={line}/>:null}</HStack>})}</VStack>}
  </VStack>
}
