import { TransitRequest, SkillResult, Stop, LineCandidate, InternalTransitResult, Departure, Vehicle, Alert, Itinerary } from "./types"
import * as b from "./busnearby"
import * as k from "./kavnav"
import { decodeDisplayText, downsample, geometryCoords, mergeStopBoard, normalizeAlerts, normalizeItineraries, normalizeNearby, normalizePatterns, normalizeStop, normalizeVehicles, patternStops, scheduleTrips, shapeCoords } from "./normalize"
import { scheduleMs, todayJerusalem } from "./time"
import { resolveContextLine } from "./context"
import { controlMonitor, ensureSegmentHistory, startMonitor, startSavedTripWatch } from "./monitor-engagement"

const MAX_MODEL_ITEMS=6
function need(v:any,name:string):any { if(v===undefined||v===null||v==="") throw new Error(`Missing ${name}`); return v }
function place(name:string|undefined,lat:number|undefined,lon:number|undefined):string|undefined { return Number.isFinite(lat)&&Number.isFinite(lon)?`${name||"מיקום"}::${lat},${lon}`:undefined }
async function resolvePlace(query?:string,lat?:number,lon?:number,name?:string):Promise<string>{
  const p=place(name,lat,lon); if(p) return p
  const q=need(query,"place query") as string
  const results=await b.geocode(q)
  if(!results.length) throw new Error(`לא נמצא מקום עבור ${q}`)
  const x=results[0]
  return `${decodeDisplayText(x.description||x.formatted_address||q)}::${x.lat},${x.lng}`
}
async function safe<T>(promise:Promise<T>,fallback:T,warnings:string[],label:string):Promise<T>{ try{return await promise}catch(e){warnings.push(`${label}: ${e instanceof Error?e.message:String(e)}`);return fallback} }
function clean<T extends Record<string,any>>(o:T):T { return Object.fromEntries(Object.entries(o).filter(([,v])=>v!==undefined)) as T }
function compactStop(s:any){ return clean({id:s?.id,code:String(s?.code||""),name:s?.name,address:s?.address,distanceMeters:s?.distanceMeters}) }
function compactLine(l:any){ return clean({lineNumber:l?.lineNumber||l?.routeNumber,routeId:l?.routeId,routeCode:l?.routeCode||l?.code,agency:l?.agency,headsign:l?.headsign||l?.routeLongName,direction:l?.direction,alternative:l?.alternative,origin:l?.origin?compactStop(l.origin):undefined,destination:l?.destination?compactStop(l.destination):undefined}) }
function compactDeparture(d:Departure){ return clean({line:d.lineNumber,destination:d.destination,minutes:d.minutes,realtime:d.realtime,scheduledTime:d.scheduledTime,predictedTime:d.predictedTime,delayMinutes:d.delayMinutes,confidence:d.confidence,accessible:d.accessible}) }
function compactVehicle(v:Vehicle){ return clean({vehicleId:v.vehicleId,line:v.lineNumber,destination:v.destination,minutesToTarget:v.minutesToTarget,nextStopCode:v.nextStopCode,lastReported:v.lastReported,delayMinutes:v.delayMinutes}) }
function compactAlert(a:Alert){ return clean({id:a.id,title:a.title,effect:a.effect,start:a.start,end:a.end,description:a.description?.slice(0,280)}) }
function compactItinerary(it:Itinerary){ return {index:it.index,durationMinutes:Math.round(it.durationSeconds/60),startTime:it.startTime,endTime:it.endTime,transfers:it.transfers||0,walkMinutes:Math.round((it.walkSeconds||0)/60),walkDistanceMeters:Math.round(it.walkDistanceMeters||0),fare:it.fare,legs:it.legs.map(l=>clean({mode:l.mode,line:l.route,headsign:l.headsign,from:l.from?.name,to:l.to?.name,startTime:l.startTime,endTime:l.endTime,durationMinutes:Math.round((l.durationSeconds||0)/60),realtime:l.realtime}))} }

function normalizeText(s:string|undefined){ return String(s||"").trim().replace(/\s+/g," ") }
function extractLineNumber(req:TransitRequest):string|undefined{
  if(req.lineNumber) return String(req.lineNumber).trim()
  const q=normalizeText(req.query)
  const m=q.match(/(?:^|\s)(?:קו\s*)?([0-9]{1,4}[א-תA-Za-z]?)\b/)
  return m?.[1] || (/^[0-9]{1,4}[א-תA-Za-z]?$/.test(q)?q:undefined)
}
async function searchStops(query:string):Promise<Stop[]>{ return (await b.stopSearch(query)).map(normalizeStop).filter(s=>s.code) }
function stopScore(s:Stop,q:string):number{
  const n=normalizeText(q).toLowerCase(), name=normalizeText(s.name).toLowerCase(), address=normalizeText(s.address).toLowerCase()
  let score=0
  if(s.code===q) score+=1000
  if(s.id===q) score+=900
  if(name===n) score+=700
  if(name.startsWith(n)) score+=500
  if(name.includes(n)) score+=350
  if(address.includes(n)) score+=100
  return score
}
async function resolveStop(req:TransitRequest):Promise<Stop>{
  if(req.stopCode) return {id:req.stopId,code:String(req.stopCode),name:req.query||`תחנה ${req.stopCode}`}
  const q=normalizeText(req.query||req.stopId)
  if(!q) throw new Error("חסר שם תחנה או stopCode")
  const found=await searchStops(q)
  if(!found.length){
    if(/^\d{3,6}$/.test(q)) return {id:req.stopId,code:q,name:`תחנה ${q}`}
    throw new Error(`לא נמצאה תחנה עבור ${q}`)
  }
  return [...found].sort((a,c)=>stopScore(c,q)-stopScore(a,q))[0]
}
function lineContextScore(x:LineCandidate,terms:string[]):number{
  const headsign=normalizeText(x.headsign).toLowerCase()
  const headsignCity=headsign.split("_")[0]||""
  const longName=normalizeText(x.longName).toLowerCase()
  const agency=normalizeText(x.agency).toLowerCase()
  const originCity=normalizeText(x.origin?.city).toLowerCase()
  const destinationCity=normalizeText(x.destination?.city).toLowerCase()
  const originAddress=normalizeText(x.origin?.address).toLowerCase()
  const destinationAddress=normalizeText(x.destination?.address).toLowerCase()
  const originName=normalizeText(x.origin?.name).toLowerCase()
  const destinationName=normalizeText(x.destination?.name).toLowerCase()
  return terms.reduce((score,t)=>{
    if(headsignCity.includes(t)) score+=16
    if(originCity.includes(t)||destinationCity.includes(t)) score+=14
    if(headsign.includes(t)) score+=9
    if(longName.includes(t)) score+=5
    if(originAddress.includes(`\u05e2\u05d9\u05e8: ${t}`)||destinationAddress.includes(`\u05e2\u05d9\u05e8: ${t}`)) score+=12
    else if(originAddress.includes(t)||destinationAddress.includes(t)) score+=2
    if(originName.includes(t)||destinationName.includes(t)) score+=1
    if(agency.includes(t)) score+=1
    return score
  },0)
}
async function resolveLineCandidate(req:TransitRequest):Promise<LineCandidate>{
  if(!req.routeId && req.preferContext){
    const remembered=resolveContextLine({lineNumber:extractLineNumber(req),itineraryIndex:req.itineraryIndex,legIndex:req.legIndex})
    if(remembered?.routeId){
      return resolveLineCandidate({...req,routeId:remembered.routeId,routeCode:remembered.routeCode||req.routeCode,direction:remembered.direction||req.direction,alternative:remembered.alternative||req.alternative,preferContext:false})
    }
  }
  if(req.routeId){
    const date=req.date||todayJerusalem()
    const rr=await k.route(req.routeId,date)
    const meta=(rr.routes||[]).find((x:any)=>String(x.routeId)===String(req.routeId))||rr.routes?.[0]
    if(!meta) throw new Error("Line not found")
    const patterns=normalizePatterns(await b.patternsByShortName(String(meta.routeNumber)))
    return patterns.find(x=>x.routeId===String(req.routeId))||patterns.find(x=>x.routeCode===String(meta.code)&&x.direction===String(meta.direction)&&x.alternative===String(meta.alternative))||{routeId:String(req.routeId),lineNumber:String(meta.routeNumber),routeCode:meta.code,direction:meta.direction,alternative:meta.alternative,longName:meta.routeLongName,headsign:meta.headsign,agency:meta.agency}
  }
  const lineNumber=extractLineNumber(req)
  const candidates=req.routeCode&&!lineNumber?normalizePatterns(await b.patternsByRouteCode(req.routeCode)):normalizePatterns(await b.patternsByShortName(need(lineNumber,"lineNumber")))
  let c=candidates
  if(req.direction) c=c.filter(x=>x.direction===req.direction)
  if(req.alternative) c=c.filter(x=>x.alternative===req.alternative)
  if(req.routeCode) c=c.filter(x=>x.routeCode===req.routeCode)
  if(!c.length) throw new Error("No matching line variant")
  const context=normalizeText([req.query,req.directionQuery].filter(Boolean).join(" ")).replace(/(?:^|\s)\u05e7\u05d5\s*/g," ").replace(new RegExp(`\\b${String(lineNumber||"").replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`,"g")," ").trim().toLowerCase()
  if(context){
    const terms=context.split(/\s+/).filter(t=>t.length>1)
    const scored=c.map(x=>({x,score:lineContextScore(x,terms)})).sort((a,b)=>b.score-a.score)
    if(scored[0]?.score>0) return scored[0].x
  }
  return c[0]
}
async function enrichNearby(stops:Stop[],limit:number){
  return Promise.all(stops.slice(0,Math.min(limit,8)).map(async stop=>{
    try{
      const [summary,rt]=await Promise.all([k.stopSummary(stop.code),k.realtime({stopCode:stop.code})])
      const vehicles=normalizeVehicles(rt,stop.code)
      return {...stop,routes:(summary?.[0]?.routes||[]).slice(0,10),nextLive:vehicles.sort((a,b)=>(a.minutesToTarget??999)-(b.minutesToTarget??999)).slice(0,3).map(v=>({...v,onwardCalls:undefined}))}
    }catch{return stop}
  }))
}
function lineNumberOf(x:any):string { return String(x?.lineNumber??x?.routeNumber??x?.routeShortName??"").trim() }
function routeDirectionScore(r:any,query?:string):number{
  const q=normalizeText(query).toLowerCase(); if(!q)return 1
  const terms=q.split(/\s+/).filter(t=>t.length>1)
  const headsign=normalizeText(r?.headsign).toLowerCase(), longName=normalizeText(r?.routeLongName||r?.longName).toLowerCase(), alt=normalizeText(r?.alternativeInfo?.alternativeLongName||r?.alternativeInfo?.alternativeRouteDescription).toLowerCase()
  return terms.reduce((score,t)=>score+(headsign===t?30:headsign.includes(t)?18:(!headsign&&longName.includes(t)?8:0))+(alt.includes(t)?3:0),0)
}
function matchingRoutes(routes:any[],lineNumber:string,directionQuery?:string){
  const base=(routes||[]).filter(r=>lineNumberOf(r)===lineNumber)
  if(!directionQuery)return base
  const scored=base.map(r=>({r,score:routeDirectionScore(r,directionQuery)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score)
  if(!scored.length)return []
  const best=scored[0].score
  return scored.filter(x=>x.score>=Math.max(1,best-3)).map(x=>x.r)
}
function filterBoardToRoutes(board:{routes:any[];departures:Departure[];vehicles:Vehicle[]},lineNumber:string,selectedRoutes:any[]){
  const routeIds=new Set((selectedRoutes||[]).map(r=>String(r.routeId||"")).filter(Boolean))
  const same=(x:any)=>routeIds.size?routeIds.has(String(x?.routeId||"")):String(x?.lineNumber||x?.routeNumber||"")===lineNumber
  return {routes:(board.routes||[]).filter(same),departures:(board.departures||[]).filter(same),vehicles:(board.vehicles||[]).filter(same)}
}
function filterDepartures(req:TransitRequest,departures:Departure[]):Departure[]{
  const lines=new Set([...(req.lineNumbers||[]),req.lineNumber].map(x=>String(x||"").trim()).filter(Boolean))
  const dest=normalizeText(req.destinationQuery||req.directionQuery).toLowerCase()
  const min=Number.isFinite(req.minMinutes)?Number(req.minMinutes):undefined
  const maxCandidate=req.maxMinutes??req.withinMinutes??req.arrivalWindowMinutes
  const max=Number.isFinite(maxCandidate)?Number(maxCandidate):undefined
  return departures.filter(d=>{
    if(lines.size&&!lines.has(String(d.lineNumber||"")))return false
    if(dest&&!normalizeText(d.destination).toLowerCase().includes(dest))return false
    if(req.realtimeOnly&&!d.realtime)return false
    if(req.accessibleOnly&&d.accessible!==true)return false
    if((min!==undefined||max!==undefined)&&d.minutes===undefined)return false
    if(min!==undefined&&d.minutes!==undefined&&d.minutes<min)return false
    if(max!==undefined&&d.minutes!==undefined&&d.minutes>max)return false
    return true
  }).slice(0,Math.min(req.maxResults||req.limit||30,50))
}
function monitorConfig(out:any){ return {type:"monitor",message:out.message,monitor:out.data?.monitor,monitors:out.data?.monitors||[] } }
function filteredScheduleTrips(raw:any,date:string,routeIds:Set<string>){
  return scheduleTrips(raw).filter((t:any)=>!routeIds.size||routeIds.has(String(t.routeId))).sort((a:any,b:any)=>(scheduleMs(a.operationalDate||date,a.departureTime)??Number.MAX_SAFE_INTEGER)-(scheduleMs(b.operationalDate||date,b.departureTime)??Number.MAX_SAFE_INTEGER))
}
async function nearestStopForLine(stops:Stop[],lineNumber:string,directionQuery?:string){
  const bounded=stops.slice(0,20)
  for(let i=0;i<bounded.length;i+=5){
    const batch=bounded.slice(i,i+5)
    const checked=await Promise.all(batch.map(async stop=>{
      try{
        const summary=await k.stopSummary(stop.code), routes=summary?.[0]?.routes||[], selectedRoutes=matchingRoutes(routes,lineNumber,directionQuery)
        return selectedRoutes.length?{stop,summary,routes,selectedRoutes}:undefined
      }catch{return undefined}
    }))
    const matches=checked.filter(Boolean) as {stop:Stop;summary:any[];routes:any[];selectedRoutes:any[]}[]
    if(matches.length)return matches.sort((a,c)=>(a.stop.distanceMeters??999999)-(c.stop.distanceMeters??999999))[0]
  }
  return undefined
}
function ok(action:TransitRequest["action"],facts:any,summary:string,warnings?:string[],sources?:string[]):SkillResult{
  return {ok:true,action,summary,facts,warnings:warnings?.length?warnings:undefined,sources}
}

function matchKey(value:any):string{
  return decodeDisplayText(value).toLowerCase().replace(/[\/_.,;:()\[\]{}\-]+/g," ").replace(/\s+/g," ").trim()
}
function stopIdKey(value:any):string{return String(value||"").replace(/^1:/,"")}
type SegmentStopHints={query:string;explicitCode?:string;candidates:Stop[];codeScores:Map<string,number>;idScores:Map<string,number>}
function segmentQueryVariants(query:string):string[]{
  const q=normalizeText(query); if(!q)return []
  const xs=[q]
  if(q.includes(" "))xs.push(q.replace(/\s+/g,"/"))
  return [...new Set(xs)]
}
async function resolveSegmentStopHints(query?:string,explicitCode?:string):Promise<SegmentStopHints>{
  const q=normalizeText(query), byIdentity=new Map<string,{stop:Stop;rank:number}>()
  if(q){
    const sets=await Promise.all(segmentQueryVariants(q).map(async variant=>{try{return await searchStops(variant)}catch{return [] as Stop[]}}))
    let rank=0
    for(const list of sets)for(const stop of list){
      const identity=stop.code?`c:${stop.code}`:stop.id?`i:${stopIdKey(stop.id)}`:`n:${matchKey(stop.name)}:${rank}`
      const existing=byIdentity.get(identity)
      if(!existing||rank<existing.rank)byIdentity.set(identity,{stop,rank})
      rank++
    }
  }
  const candidates=[...byIdentity.values()].sort((a,b)=>a.rank-b.rank).map(x=>x.stop)
  const codeScores=new Map<string,number>(), idScores=new Map<string,number>()
  if(explicitCode)codeScores.set(String(explicitCode),12000)
  candidates.forEach((stop,index)=>{
    const relevance=Math.max(3200,7600-index*90)+Math.min(1200,Math.max(0,stopScore(stop,q)))
    if(stop.code)codeScores.set(String(stop.code),Math.max(codeScores.get(String(stop.code))||0,relevance))
    if(stop.id){const id=stopIdKey(stop.id);idScores.set(id,Math.max(idScores.get(id)||0,relevance+100))}
  })
  return {query:q,explicitCode:explicitCode?String(explicitCode):undefined,candidates,codeScores,idScores}
}
function segmentStopScore(stop:Stop,hints:SegmentStopHints,allowFuzzy:boolean):number{
  const code=String(stop.code||""), id=stopIdKey(stop.id)
  if(hints.explicitCode&&code===hints.explicitCode)return 12000
  let score=Math.max(code?hints.codeScores.get(code)||0:0,id?hints.idScores.get(id)||0:0)
  if(!allowFuzzy)return score
  const q=matchKey(hints.query), name=matchKey(stop.name), address=matchKey(stop.address)
  if(!q)return score
  if(name===q)score=Math.max(score,2800)
  else if(name.startsWith(q)||q.startsWith(name))score=Math.max(score,2200)
  else {
    const terms=q.split(" ").filter(t=>t.length>1)
    const nameHits=terms.filter(t=>name.includes(t)).length
    const addressHits=terms.filter(t=>address.includes(t)).length
    if(terms.length&&nameHits===terms.length)score=Math.max(score,1600+nameHits*50)
    else if(nameHits)score=Math.max(score,nameHits*300+addressHits*60)
  }
  return score
}
function bestStopIndex(stops:Stop[],hints:SegmentStopHints,start=0,allowFuzzy=false):{index:number;score:number}|undefined{
  let best:{index:number;score:number}|undefined
  for(let i=Math.max(0,start);i<stops.length;i++){
    const score=segmentStopScore(stops[i],hints,allowFuzzy)
    if(score>0&&(!best||score>best.score))best={index:i,score}
  }
  return best
}
async function mapConcurrent<T,R>(items:T[],limit:number,fn:(item:T,index:number)=>Promise<R>):Promise<R[]>{
  const out=new Array<R>(items.length); let next=0
  const worker=async()=>{for(;;){const index=next++;if(index>=items.length)return;out[index]=await fn(items[index],index)}}
  await Promise.all(new Array(Math.min(Math.max(1,limit),Math.max(1,items.length))).fill(0).map(worker))
  return out
}
type LineSegmentMatch={candidate:LineCandidate;stops:Stop[];fromStop:Stop;toStop:Stop;fromIndex:number;toIndex:number;score:number;matchMode:"resolved_stop"|"fuzzy"}
type LineSegmentResolution=LineSegmentMatch&{alternatives?:LineSegmentMatch[]}
async function resolveLineSegment(req:TransitRequest):Promise<LineSegmentResolution>{
  const lineNumber=String(need(extractLineNumber(req)||req.lineNumber,"lineNumber"))
  const fromQuery=normalizeText(req.fromStopQuery||req.fromQuery), toQuery=normalizeText(req.toStopQuery||req.toQuery)
  if(!fromQuery&&!req.fromStopCode)throw new Error("חסרה תחנת מוצא")
  if(!toQuery&&!req.toStopCode)throw new Error("חסרה תחנת יעד")
  const [fromHints,toHints]=await Promise.all([resolveSegmentStopHints(fromQuery,req.fromStopCode),resolveSegmentStopHints(toQuery,req.toStopCode)])
  let candidates=normalizePatterns(await b.patternsByShortName(lineNumber))
  if(req.routeId)candidates=candidates.filter(c=>String(c.routeId)===String(req.routeId))
  if(req.routeCode)candidates=candidates.filter(c=>String(c.routeCode||"")===String(req.routeCode))
  if(req.direction)candidates=candidates.filter(c=>String(c.direction||"")===String(req.direction))
  if(req.alternative)candidates=candidates.filter(c=>String(c.alternative||"")===String(req.alternative))
  if(!candidates.length)throw new Error(`לא נמצא קו ${lineNumber}`)
  const directionTerms=matchKey(req.directionQuery||req.destinationQuery||toQuery).split(" ").filter(t=>t.length>1)
  const scanned=await mapConcurrent(candidates,6,async c=>{
    if(!c.patternId)return {exact:undefined as LineSegmentMatch|undefined,fuzzy:undefined as LineSegmentMatch|undefined}
    let stops:Stop[]=[]
    try{stops=patternStops(await b.patternDetail(c.patternId))}catch{return {exact:undefined as LineSegmentMatch|undefined,fuzzy:undefined as LineSegmentMatch|undefined}}
    if(stops.length<2)return {exact:undefined as LineSegmentMatch|undefined,fuzzy:undefined as LineSegmentMatch|undefined}
    const directionBonus=directionTerms.length?lineContextScore(c,directionTerms):0
    const build=(from:{index:number;score:number},to:{index:number;score:number},matchMode:"resolved_stop"|"fuzzy"):LineSegmentMatch=>({
      score:from.score+to.score+directionBonus*20-(to.index-from.index)*0.01,
      candidate:c,stops,fromStop:stops[from.index],toStop:stops[to.index],fromIndex:from.index,toIndex:to.index,matchMode
    })
    const fromExact=bestStopIndex(stops,fromHints,0,false)
    const toExact=fromExact?bestStopIndex(stops,toHints,fromExact.index+1,false):undefined
    const exact=fromExact&&toExact?build(fromExact,toExact,"resolved_stop"):undefined
    const fromFuzzy=bestStopIndex(stops,fromHints,0,true)
    const toFuzzy=fromFuzzy?bestStopIndex(stops,toHints,fromFuzzy.index+1,true):undefined
    const fuzzy=fromFuzzy&&toFuzzy?build(fromFuzzy,toFuzzy,"fuzzy"):undefined
    return {exact,fuzzy}
  })
  const exactMatches=scanned.map(x=>x.exact).filter(Boolean) as LineSegmentMatch[]
  const fuzzyMatches=scanned.map(x=>x.fuzzy).filter(Boolean) as LineSegmentMatch[]
  const matches=(exactMatches.length?exactMatches:fuzzyMatches).sort((a,b)=>b.score-a.score)
  if(!matches.length)throw new Error(`לא נמצאה וריאציה של קו ${lineNumber} שעוברת מתחנת המוצא לתחנת היעד בסדר המבוקש`)
  return {...matches[0],alternatives:matches.slice(1)}
}
function arrayValue(...values:any[]):any[]{for(const v of values)if(Array.isArray(v))return v;return []}
function tripCalls(raw:any,trip:any):any[]{
  const direct=arrayValue(trip?.stopTimes,trip?.stop_times,trip?.stops,trip?.calls,trip?.stopSchedule,trip?.stopSchedule?.stops,trip?.onwardCalls?.calls)
  if(direct.length)return direct
  const top=arrayValue(raw?.stopTimes,raw?.stop_times,raw?.stops,raw?.calls,raw?.routeStopTimes)
  if(!top.length)return []
  const tripId=String(trip?.tripId||trip?.id||"")
  return tripId?top.filter((x:any)=>String(x?.tripId||x?.trip_id||x?.trip?.id||"")===tripId):top
}
function callCode(x:any):string{return String(x?.stopCode||x?.stop_code||x?.code||x?.stop?.code||x?.stop?.stopCode||"")}
function callId(x:any):string{return String(x?.stopId||x?.stop_id||x?.stop?.id||x?.stop?.stopId||"").replace(/^1:/,"")}
function callName(x:any):string{return decodeDisplayText(x?.stopName||x?.stop_name||x?.name||x?.stop?.name||"")}
function callMatches(x:any,stop:Stop):boolean{
  if(stop.code&&callCode(x)&&String(stop.code)===callCode(x))return true
  if(stop.id&&callId(x)&&String(stop.id).replace(/^1:/,"")===callId(x))return true
  const a=matchKey(callName(x)), b=matchKey(stop.name)
  return !!a&&!!b&&(a===b||a.includes(b)||b.includes(a))
}
function secondsClock(value:number):string{
  const v=Math.max(0,Math.round(value)), h=Math.floor(v/3600), m=Math.floor((v%3600)/60), sec=v%60
  return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`
}
function scheduleValueMs(date:string,value:any):number|undefined{
  if(value===undefined||value===null||value==="")return undefined
  if(typeof value==="number"&&Number.isFinite(value)){
    if(value>1e12)return value
    if(value>1e9)return value*1000
    if(value>=0&&value<172800)return scheduleMs(date,secondsClock(value))
  }
  const text=String(value)
  if(/^\d{1,2}:\d{2}(?::\d{2})?$/.test(text))return scheduleMs(date,text)
  const parsed=Date.parse(text)
  return Number.isFinite(parsed)?parsed:undefined
}
function fromCallTime(x:any):any{return x?.departureTime??x?.scheduledDepartureTime??x?.departure_time??x?.departure??x?.arrivalTime??x?.scheduledArrivalTime??x?.arrival_time??x?.arrival??x?.time}
function toCallTime(x:any):any{return x?.arrivalTime??x?.scheduledArrivalTime??x?.arrival_time??x?.arrival??x?.departureTime??x?.scheduledDepartureTime??x?.departure_time??x?.departure??x?.time}
type ScheduledSegmentSample={tripId?:string;fromMs:number;toMs:number;durationMinutes:number}
type LiveSegmentEstimate={durationMinutes:number;vehicleId?:string;tripId?:string;fromEta:string;toEta:string;fromMs:number;toMs:number;lastReported?:string}
function scheduledSegmentSamples(raw:any,date:string,fromStop:Stop,toStop:Stop):ScheduledSegmentSample[]{
  const out:ScheduledSegmentSample[]=[]
  for(const trip of (raw?.trips||[])){
    const calls=tripCalls(raw,trip); if(calls.length<2)continue
    let fromIndex=-1,toIndex=-1
    for(let i=0;i<calls.length;i++){if(fromIndex<0&&callMatches(calls[i],fromStop)){fromIndex=i;continue}if(fromIndex>=0&&i>fromIndex&&callMatches(calls[i],toStop)){toIndex=i;break}}
    if(fromIndex<0||toIndex<0)continue
    const serviceDate=String(trip?.operationalDate||date)
    const a=scheduleValueMs(serviceDate,fromCallTime(calls[fromIndex])), z=scheduleValueMs(serviceDate,toCallTime(calls[toIndex]))
    if(a===undefined||z===undefined)continue
    let adjustedTo=z; if(adjustedTo-a<0&&adjustedTo-a>-24*3600000)adjustedTo+=24*3600000
    const minutes=(adjustedTo-a)/60000
    if(minutes>0&&minutes<=720)out.push({tripId:String(trip?.tripId||"")||undefined,fromMs:a,toMs:adjustedTo,durationMinutes:minutes})
  }
  return out
}
function scheduledSegmentDurations(raw:any,date:string,fromStop:Stop,toStop:Stop):number[]{return scheduledSegmentSamples(raw,date,fromStop,toStop).map(x=>x.durationMinutes)}
function median(values:number[]):number|undefined{if(!values.length)return undefined;const xs=[...values].sort((a,b)=>a-b),m=Math.floor(xs.length/2);return xs.length%2?xs[m]:(xs[m-1]+xs[m])/2}
function idTail(value:any):string{return String(value||"").split(":").pop()||""}
function scheduledReference(samples:ScheduledSegmentSample[],tripId?:string,referenceMs=Date.now()):{durationMinutes:number;tripId?:string;departureTime?:string;basis:string}|undefined{
  if(!samples.length)return undefined
  const exact=tripId?samples.find(x=>idTail(x.tripId)===idTail(tripId)):undefined
  if(exact)return {durationMinutes:Math.max(1,Math.round(exact.durationMinutes)),tripId:exact.tripId,departureTime:new Date(exact.fromMs).toISOString(),basis:"same_trip"}
  const nearest=[...samples].sort((a,b)=>Math.abs(a.fromMs-referenceMs)-Math.abs(b.fromMs-referenceMs))[0]
  if(nearest&&Math.abs(nearest.fromMs-referenceMs)<=3*60*60*1000)return {durationMinutes:Math.max(1,Math.round(nearest.durationMinutes)),tripId:nearest.tripId,departureTime:new Date(nearest.fromMs).toISOString(),basis:"nearest_trip"}
  const typical=median(samples.map(x=>x.durationMinutes))
  return typical===undefined?undefined:{durationMinutes:Math.max(1,Math.round(typical)),basis:"daily_median"}
}
function rawSegmentCall(calls:any[],stopCode:string):any|undefined{return calls.find((c:any)=>String(c?.stopCode||"")===String(stopCode))}
async function liveSegmentEstimate(segment:{candidate:LineCandidate;fromStop:Stop;toStop:Stop},warnings:string[],cache?:Map<string,any>):Promise<LiveSegmentEstimate|undefined>{
  const query=segment.candidate.routeCode?{routeCode:String(segment.candidate.routeCode)}:{stopCode:String(segment.fromStop.code)}
  const cacheKey=segment.candidate.routeCode?`route:${String(segment.candidate.routeCode)}`:`stop:${String(segment.fromStop.code)}`
  let raw=cache?.get(cacheKey)
  if(!raw){raw=await safe(k.realtime(query),{vehicles:[]} as any,warnings,"segment realtime");cache?.set(cacheKey,raw)}
  const now=Date.now(), routeId=idTail(segment.candidate.routeId), estimates:LiveSegmentEstimate[]=[]
  for(const vehicle of (raw?.vehicles||[])){
    if(routeId&&idTail(vehicle?.trip?.routeId)!==routeId)continue
    const calls=Array.isArray(vehicle?.trip?.onwardCalls?.calls)?vehicle.trip.onwardCalls.calls:[]
    const from=rawSegmentCall(calls,segment.fromStop.code), to=rawSegmentCall(calls,segment.toStop.code)
    if(!from?.eta||!to?.eta)continue
    const fromSeq=Number(from?.stopSeq),toSeq=Number(to?.stopSeq)
    if(Number.isFinite(fromSeq)&&Number.isFinite(toSeq)&&toSeq<=fromSeq)continue
    const fromMs=Date.parse(String(from.eta)),toMs=Date.parse(String(to.eta))
    if(!Number.isFinite(fromMs)||!Number.isFinite(toMs)||toMs<=fromMs||fromMs<now-90_000)continue
    const duration=(toMs-fromMs)/60000
    if(!(duration>0&&duration<=720))continue
    estimates.push({durationMinutes:Math.max(1,Math.round(duration)),vehicleId:String(vehicle?.vehicleId||"")||undefined,tripId:String(vehicle?.trip?.gtfsInfo?.tripId||"")||undefined,fromEta:String(from.eta),toEta:String(to.eta),fromMs,toMs,lastReported:vehicle?.lastReported})
  }
  return estimates.sort((a,b)=>a.fromMs-b.fromMs)[0]
}
async function directionsSegmentDurations(req:TransitRequest,segment:{candidate:LineCandidate;fromStop:Stop;toStop:Stop}):Promise<number[]>{
  const from=segment.fromStop,to=segment.toStop,line=String(segment.candidate.lineNumber||req.lineNumber||"")
  const fromPlace=place(from.name,from.coordinate?.latitude,from.coordinate?.longitude)||await resolvePlace(req.fromStopQuery||req.fromQuery||from.name)
  const toPlace=place(to.name,to.coordinate?.latitude,to.coordinate?.longitude)||await resolvePlace(req.toStopQuery||req.toQuery||to.name)
  const raw=await b.directions({fromPlace,toPlace,date:req.date,time:req.time,arriveBy:req.arriveBy,wheelchair:req.wheelchair,numItineraries:8})
  const exactRoute=String(segment.candidate.routeId||"")
  const durations:number[]=[]
  for(const it of normalizeItineraries(raw))for(const leg of it.legs){
    if(leg.mode==="WALK")continue
    const sameLine=String(leg.route||"")===line
    const sameRoute=!exactRoute||!leg.routeId||String(leg.routeId)===exactRoute
    if(sameLine&&sameRoute&&Number.isFinite(leg.durationSeconds)&&Number(leg.durationSeconds)>0)durations.push(Number(leg.durationSeconds)/60)
  }
  return durations
}

export async function executeInternal(req:TransitRequest,includeRender=false):Promise<InternalTransitResult>{
  const action=need(req?.action,"action") as TransitRequest["action"]
  const date=req.date||todayJerusalem()
  const limit=Math.min(req.limit||20,50)
  const detail=req.detail||"compact"
  try {
    if(action==="geocode"){
      const xs=await b.geocode(need(req.query,"query"))
      const items=xs.slice(0,detail==="full"?Math.min(limit,15):5).map((x:any)=>clean({description:x.description||x.formatted_address,name:x.name,lat:x.lat,lng:x.lng,stopCode:x.stopCode||x.code,stopId:x.stopId||x.id}))
      return {result:ok(action,{results:items,total:xs.length},`נמצאו ${items.length} מיקומים`,undefined,["BusNearby"])}
    }
    if(action==="search_stops"){
      const stops=(await searchStops(String(need(req.query||req.stopCode,"query")))).slice(0,limit)
      const render={type:"nearby",title:`תוצאות עבור ${req.query||req.stopCode}`,stops:stops.slice(0,20)}
      const facts={stops:stops.slice(0,detail==="full"?15:MAX_MODEL_ITEMS).map(compactStop),total:stops.length}
      return {result:ok(action,facts,`נמצאו ${stops.length} תחנות`,undefined,["BusNearby"]),renderConfig:includeRender?render:undefined}
    }
    if(action==="nearby_stops"){
      const lat=need(req.lat,"lat"), lon=need(req.lon,"lon")
      const stops=normalizeNearby(await b.nearbyStops(lat,lon,req.radius||1000,req.max||10))
      const bounded=stops.slice(0,req.max||10)
      const enriched=req.includeLive===false?bounded:await enrichNearby(bounded,req.max||10)
      const render={type:"nearby",title:"תחנות קרובות",userCoordinate:{latitude:lat,longitude:lon},stops:enriched}
      const facts={stops:enriched.slice(0,detail==="full"?10:5).map((s:any)=>({...compactStop(s),nextLive:(s.nextLive||[]).slice(0,2).map(compactVehicle),routeCount:Array.isArray(s.routes)?s.routes.length:undefined})),total:enriched.length}
      return {result:ok(action,facts,`${enriched.length} תחנות קרובות`,undefined,["BusNearby","KavNav"]),renderConfig:includeRender?render:undefined}
    }
    if(action==="nearby_line"){
      const lat=need(req.lat,"lat"), lon=need(req.lon,"lon"), lineNumber=String(need(extractLineNumber(req)||req.lineNumber,"lineNumber")), mode=req.departureMode||"next", directionQuery=normalizeText(req.directionQuery)
      const firstRadius=req.radius||1200, firstMax=Math.min(req.max||14,20)
      let stops=normalizeNearby(await b.nearbyStops(lat,lon,firstRadius,firstMax))
      let match=await nearestStopForLine(stops,lineNumber,directionQuery)
      if(!match&&!req.radius){stops=normalizeNearby(await b.nearbyStops(lat,lon,2500,20));match=await nearestStopForLine(stops,lineNumber,directionQuery)}
      if(!match)throw new Error(directionQuery?`לא נמצאה תחנה קרובה שבה עובר קו ${lineNumber} לכיוון ${directionQuery}`:`לא נמצאה תחנה קרובה שבה עובר קו ${lineNumber}`)
      const stop=match.stop, stopCode=stop.code, summary=match.summary, selectedRoutes=match.selectedRoutes, routeIds=new Set(selectedRoutes.map((r:any)=>String(r.routeId)).filter(Boolean)), warnings:string[]=[]
      const schedule=await k.stopSchedule(stopCode,date), meta=summary?.[0]||{}, stopId=req.stopId||stop.id||meta.stopId
      const resolvedStop={id:String(stopId||""),code:stopCode,name:decodeDisplayText(meta.stopName||meta.name||stop.name||`תחנה ${stopCode}`),address:stop.address,coordinate:stop.coordinate,distanceMeters:stop.distanceMeters}
      if(mode!=="next"){
        const all=filteredScheduleTrips(schedule,date,routeIds), picked=mode==="last"?(all.length?[all[all.length-1]]:[]):mode==="first"?all.slice(0,1):all
        const render={type:"schedule",scope:"nearby-line",title:`קו ${lineNumber} · ${resolvedStop.name}`,date,trips:picked.slice(0,300),stopCode,routeIds:[...routeIds],lineNumber,directionLabel:directionQuery||selectedRoutes[0]?.headsign,routes:selectedRoutes,minDate:schedule.minDate,maxDate:schedule.maxDate,mode:mode==="schedule"?"schedule":mode}
        const facts={lineNumber,direction:directionQuery||selectedRoutes[0]?.headsign,stop:compactStop(resolvedStop),date,mode,trips:picked.slice(0,detail==="full"?12:4).map((t:any)=>clean({departureTime:t.departureTime,headsign:t.headsign,routeId:t.routeId})),total:all.length}
        return {result:ok(action,facts,mode==="last"?`הנסיעה האחרונה של קו ${lineNumber}`:mode==="first"?`הנסיעה הראשונה של קו ${lineNumber}`:`לוח קו ${lineNumber}`,warnings,["BusNearby","KavNav"]),renderConfig:includeRender?render:undefined}
      }
      const rt=await safe(k.realtime({stopCode}),{vehicles:[]} as any,warnings,"realtime")
      const alertRaw=req.includeAlerts===false?{alerts:[]}:await safe(stopId?k.alerts({stopId:String(stopId)}):Promise.resolve({alerts:[]}),{alerts:[]} as any,warnings,"alerts"), alerts=normalizeAlerts(alertRaw)
      const board=filterBoardToRoutes(mergeStopBoard(stopCode,date,summary,schedule,rt,Math.min(limit,30)),lineNumber,selectedRoutes)
      const departures=filterDepartures(req,board.departures)
      const render={type:"stop-board",stop:resolvedStop,date,routes:board.routes,departures,vehicles:board.vehicles.slice(0,20).map(v=>({...v,onwardCalls:undefined})),alerts:alerts.slice(0,8),lastVehicleReport:rt?.lastVehicleReport,neighbors:(meta.neighbors||[]).slice(0,20),restrictions:meta.restrictions||{},lineFilter:lineNumber,routeIdFilter:[...routeIds]}
      const facts={lineNumber,direction:directionQuery||selectedRoutes[0]?.headsign,stop:compactStop(resolvedStop),departures:departures.slice(0,detail==="full"?12:6).map(compactDeparture),liveVehicleCount:board.vehicles.length,nearbyStopsChecked:stops.length,date}
      return {result:ok(action,facts,`${departures.length} הגעות תואמות לקו ${lineNumber}`,warnings,["BusNearby","KavNav"]),renderConfig:includeRender?render:undefined}
    }
    if(action==="search_lines"){
      const lineNumber=extractLineNumber(req)||String(need(req.query,"lineNumber"))
      const lines=normalizePatterns(await b.patternsByShortName(lineNumber)).slice(0,limit)
      const render={type:"line-candidates",title:`קו ${lineNumber}`,lines:lines.slice(0,20)}
      const facts={lines:lines.slice(0,detail==="full"?15:6).map(compactLine),total:lines.length}
      return {result:ok(action,facts,`${lines.length} חלופות/כיוונים`,undefined,["BusNearby"]),renderConfig:includeRender?render:undefined}
    }
    if(action==="stop_board"){
      const resolved=await resolveStop(req), stopCode=resolved.code, warnings:string[]=[]
      const [summary,schedule]=await Promise.all([k.stopSummary(stopCode),k.stopSchedule(stopCode,date)])
      const rt=await safe(k.realtime({stopCode}),{vehicles:[]} as any,warnings,"realtime")
      const meta=summary?.[0]||{}
      const stopId=req.stopId||resolved.id||meta.stopId
      const alertRaw=req.includeAlerts===false?{alerts:[]}:await safe(stopId?k.alerts({stopId:String(stopId)}):Promise.resolve({alerts:[]}),{alerts:[]} as any,warnings,"alerts")
      const alerts=normalizeAlerts(alertRaw)
      const board=mergeStopBoard(stopCode,date,summary,schedule,rt,Math.min(limit,30))
      const departures=filterDepartures(req,board.departures)
      const stop={id:String(stopId||""),code:stopCode,name:decodeDisplayText(meta.stopName||meta.name||resolved.name||`תחנה ${stopCode}`),address:resolved.address,coordinate:resolved.coordinate}
      const render={type:"stop-board",stop,date,routes:board.routes.slice(0,30),departures,vehicles:board.vehicles.slice(0,20).map(v=>({...v,onwardCalls:undefined})),alerts:alerts.slice(0,8),lastVehicleReport:rt?.lastVehicleReport,neighbors:(meta.neighbors||[]).slice(0,20),restrictions:meta.restrictions||{}}
      const facts={stop,departures:departures.slice(0,detail==="full"?15:8).map(compactDeparture),routeCount:board.routes.length,liveVehicleCount:board.vehicles.length,alertCount:alerts.length,alerts:alerts.slice(0,detail==="full"?5:2).map(compactAlert),lastVehicleReport:rt?.lastVehicleReport,date}
      return {result:ok(action,facts,`${departures.length} יציאות תואמות`,warnings,["BusNearby","KavNav"]),renderConfig:includeRender?render:undefined}
    }
    if(action==="stop_watch"){
      const requestedStopCodes=[...new Set([...(req.stopCodes||[]),req.stopCode].map(x=>String(x||"").trim()).filter(Boolean))]
      let resolved:Stop
      if(!requestedStopCodes.length&&!req.query&&Number.isFinite(req.lat)&&Number.isFinite(req.lon)){
        const nearby=normalizeNearby(await b.nearbyStops(Number(req.lat),Number(req.lon),req.radius||1000,3))
        if(!nearby.length)throw new Error("לא נמצאה תחנה קרובה")
        resolved=nearby[0]
      }else resolved=await resolveStop({...req,query:req.stopQuery||req.query,stopCode:req.stopCode||requestedStopCodes[0]})
      const stopCode=resolved.code, summary=await k.stopSummary(stopCode), meta=summary?.[0]||{}
      const stopId=String(req.stopId||resolved.id||meta.stopId||"")||undefined
      const stopName=decodeDisplayText(meta.stopName||meta.name||resolved.name||`תחנה ${stopCode}`)
      const requestedLines=[...(req.lineNumbers||[]),req.lineNumber].map(x=>String(x||"").trim()).filter(Boolean)
      let routeIds:string[]=[]
      if(requestedLines.length){
        const routes=meta.routes||[]
        for(const line of requestedLines){
          const matches=matchingRoutes(routes,line,req.directionQuery||req.destinationQuery)
          routeIds.push(...matches.map((r:any)=>String(r.routeId||"")).filter(Boolean))
        }
        routeIds=[...new Set(routeIds)]
      }
      if(requestedStopCodes.length>1)routeIds=[]
      const out=await startMonitor({kind:"stop",title:req.lineNumber?`קו ${req.lineNumber} · ${stopName}`:requestedStopCodes.length>1?`מעקב ${requestedStopCodes.length} תחנות`:stopName,stopCode,stopCodes:requestedStopCodes.length?requestedStopCodes:undefined,stopId,stopName,lineNumber:req.lineNumber,lineNumbers:requestedLines,routeIds,directionQuery:req.directionQuery,destinationQuery:req.destinationQuery,departureMode:req.departureMode,date:req.date,pollIntervalSeconds:req.pollIntervalSeconds,arrivalWindowMinutes:req.arrivalWindowMinutes??req.withinMinutes??req.maxMinutes,minMinutes:req.minMinutes,maxMinutes:req.maxMinutes??req.withinMinutes??req.arrivalWindowMinutes,maxResults:req.maxResults,realtimeOnly:req.realtimeOnly,accessibleOnly:req.accessibleOnly,notifyMode:req.notifyMode,condition:req.watchCondition,delayAtLeastMinutes:req.delayAtLeastMinutes,etaChangeMinutes:req.etaChangeMinutes,connectionBufferMinutes:req.connectionBufferMinutes,stopAfterFirstMatch:req.stopAfterFirstMatch,durationMinutes:req.durationMinutes,until:req.until,maxChecks:req.maxChecks,delivery:req.delivery})
      if(!out.ok)throw new Error(out.message)
      return {result:ok(action,{monitor:out.data?.monitor},out.message,undefined,["BusNearby","KavNav"]),renderConfig:includeRender?monitorConfig(out):undefined}
    }
    if(action==="line_watch"){
      const lineNumber=String(need(extractLineNumber(req)||req.lineNumber,"lineNumber"))
      let stop:Stop|undefined, selectedRoutes:any[]=[]
      if(req.stopCode||req.stopQuery){
        stop=await resolveStop({...req,query:req.stopQuery||req.stopCode,lineNumber:undefined})
      }else if(Number.isFinite(req.lat)&&Number.isFinite(req.lon)){
        const nearby=normalizeNearby(await b.nearbyStops(Number(req.lat),Number(req.lon),req.radius||1200,Math.min(req.max||16,20)))
        const match=await nearestStopForLine(nearby,lineNumber,req.directionQuery||req.destinationQuery)
        if(match){stop=match.stop;selectedRoutes=match.selectedRoutes}
      }
      if(stop){
        const summary=await k.stopSummary(stop.code), meta=summary?.[0]||{}
        if(!selectedRoutes.length)selectedRoutes=matchingRoutes(meta.routes||[],lineNumber,req.directionQuery||req.destinationQuery)
        const routeIds=selectedRoutes.map((r:any)=>String(r.routeId||"")).filter(Boolean)
        const stopName=decodeDisplayText(meta.stopName||meta.name||stop.name||`תחנה ${stop.code}`)
        const out=await startMonitor({kind:"stop",title:`קו ${lineNumber} · ${stopName}`,stopCode:stop.code,stopId:String(req.stopId||stop.id||meta.stopId||"")||undefined,stopName,lineNumber,lineNumbers:[lineNumber],routeIds,directionQuery:req.directionQuery,destinationQuery:req.destinationQuery,departureMode:req.departureMode,date:req.date,followLocation:req.followLocation,radius:req.radius,pollIntervalSeconds:req.pollIntervalSeconds,arrivalWindowMinutes:req.arrivalWindowMinutes??req.withinMinutes??req.maxMinutes,minMinutes:req.minMinutes,maxMinutes:req.maxMinutes??req.withinMinutes??req.arrivalWindowMinutes,maxResults:req.maxResults,realtimeOnly:req.realtimeOnly,accessibleOnly:req.accessibleOnly,notifyMode:req.notifyMode,condition:req.watchCondition,delayAtLeastMinutes:req.delayAtLeastMinutes,etaChangeMinutes:req.etaChangeMinutes,connectionBufferMinutes:req.connectionBufferMinutes,stopAfterFirstMatch:req.stopAfterFirstMatch,durationMinutes:req.durationMinutes,until:req.until,maxChecks:req.maxChecks,delivery:req.delivery})
        if(!out.ok)throw new Error(out.message)
        return {result:ok(action,{monitor:out.data?.monitor},out.message,undefined,["BusNearby","KavNav"]),renderConfig:includeRender?monitorConfig(out):undefined}
      }
      const c=await resolveLineCandidate({...req,lineNumber}), routeId=String(req.routeId||c.routeId), routeCode=String(req.routeCode||c.routeCode||"")
      if(!routeCode)throw new Error("Cannot resolve routeCode for line monitor")
      const out=await startMonitor({kind:"line",title:`מעקב קו ${lineNumber}`,routeId,routeIds:[routeId],routeCode,lineNumber,directionQuery:req.directionQuery,destinationQuery:req.destinationQuery,pollIntervalSeconds:req.pollIntervalSeconds,maxResults:req.maxResults,notifyMode:req.notifyMode,condition:req.watchCondition||"vehicle_change",delayAtLeastMinutes:req.delayAtLeastMinutes,etaChangeMinutes:req.etaChangeMinutes,connectionBufferMinutes:req.connectionBufferMinutes,stopAfterFirstMatch:req.stopAfterFirstMatch,durationMinutes:req.durationMinutes,until:req.until,maxChecks:req.maxChecks,delivery:req.delivery})
      if(!out.ok)throw new Error(out.message)
      return {result:ok(action,{monitor:out.data?.monitor},out.message,undefined,["BusNearby","KavNav"]),renderConfig:includeRender?monitorConfig(out):undefined}
    }
    if(action==="alerts_watch"){
      let stopId=req.stopId, routeId=req.routeId, stopCode=req.stopCode, lineNumber=extractLineNumber(req)
      let title="מעקב התראות תחבורה"
      if(!stopId&&(stopCode||req.stopQuery||(req.query&&!lineNumber))){
        const stop=await resolveStop({...req,query:req.stopQuery||req.query})
        const ss=await k.stopSummary(stop.code), meta=ss?.[0]||{}
        stopCode=stop.code;stopId=String(meta.stopId||stop.id||"")||undefined;title=`התראות · ${decodeDisplayText(meta.stopName||meta.name||stop.name)}`
      }
      if(!stopId&&!routeId){const c=await resolveLineCandidate(req);routeId=c.routeId;lineNumber=c.lineNumber;title=`התראות קו ${c.lineNumber}`}
      const out=await startMonitor({kind:"alerts",title,stopId,stopCode,routeId,lineNumber,pollIntervalSeconds:req.pollIntervalSeconds||300,maxResults:req.maxResults,notifyMode:req.notifyMode||"new_matches",condition:req.watchCondition||"new_alerts",stopAfterFirstMatch:req.stopAfterFirstMatch,durationMinutes:req.durationMinutes,until:req.until,maxChecks:req.maxChecks,delivery:req.delivery})
      if(!out.ok)throw new Error(out.message)
      return {result:ok(action,{monitor:out.data?.monitor},out.message,undefined,["KavNav"]),renderConfig:includeRender?monitorConfig(out):undefined}
    }
    if(action==="trip_watch"){
      const out=await startSavedTripWatch(req)
      if(!out.ok)throw new Error(out.message)
      return {result:ok(action,{monitor:out.data?.monitor},out.message,undefined,["KavNav"]),renderConfig:includeRender?monitorConfig(out):undefined}
    }
    if(action==="watch_control"){
      const out=await controlMonitor(req)
      if(!out.ok)throw new Error(out.message)
      return {result:ok(action,out.data||{},out.message,undefined,["Israel Transit Monitor"]),renderConfig:includeRender?monitorConfig(out):undefined}
    }
    if(action==="stop_schedule"){
      const resolved=await resolveStop(req), stopCode=resolved.code
      const [raw,summary]=await Promise.all([k.stopSchedule(stopCode,date),k.stopSummary(stopCode)])
      const allTrips=scheduleTrips(raw), trips=allTrips.slice(0,300), routes=summary?.[0]?.routes||[]
      const render={type:"schedule",scope:"stop",title:`${resolved.name} · ${stopCode}`,date,trips,stopCode,routes,minDate:raw.minDate,maxDate:raw.maxDate,mode:"schedule"}
      const facts={stop:compactStop(resolved),date,trips:trips.slice(0,detail==="full"?15:8).map((t:any)=>clean({tripId:t.tripId,routeId:t.routeId,headsign:t.headsign,departureTime:t.departureTime,originDepartureTime:t.originDepartureTime})),total:allTrips.length,minDate:raw.minDate,maxDate:raw.maxDate}
      return {result:ok(action,facts,`${trips.length} נסיעות`,undefined,["BusNearby","KavNav"]),renderConfig:includeRender?render:undefined}
    }
    if(action==="line_live"){
      const c=await resolveLineCandidate(req), routeId=String(req.routeId||c.routeId), routeCode=String(req.routeCode||c.routeCode||""), warnings:string[]=[]
      if(!routeCode) throw new Error("Cannot resolve routeCode")
      const routeRaw=await safe(k.route(routeId,date),{routes:[]} as any,warnings,"route")
      const patternRaw=c.patternId?await safe(b.patternDetail(c.patternId),null as any,warnings,"pattern details"):null
      const geometryRaw=c.patternId?await safe(b.patternGeometry(c.patternId),null as any,warnings,"route geometry"):null
      const rt=await k.realtime({routeCode})
      const stops=patternRaw?patternStops(patternRaw):[]
      let coordinates=geometryRaw?downsample(geometryCoords(geometryRaw),600):[]
      if(!coordinates.length&&stops.length) coordinates=stops.map(s=>s.coordinate).filter(Boolean) as any
      const vehicles=normalizeVehicles(rt).filter(v=>!routeId||v.routeId===routeId).slice(0,limit)
      const meta=(routeRaw.routes||[]).find((x:any)=>String(x.routeId)===routeId)||routeRaw.routes?.[0]
      const line={...c,...meta,routeId}
      const safeVehicles=vehicles.slice(0,30).map(v=>({...v,onwardCalls:undefined}))
      const render={type:"line",line,stops:stops.slice(0,120),coordinates,vehicles:safeVehicles,alerts:[],lastVehicleReport:rt.lastVehicleReport,liveOnly:true}
      const facts={line:compactLine(line),vehicles:vehicles.slice(0,detail==="full"?15:8).map(compactVehicle),total:vehicles.length,lastVehicleReport:rt.lastVehicleReport,hasGeometry:coordinates.length>1}
      return {result:ok(action,facts,`${vehicles.length} vehicles reporting`,warnings,["BusNearby","KavNav"]),renderConfig:includeRender?render:undefined}
    }
    if(action==="line_details"){
      const c=await resolveLineCandidate(req), routeId=String(req.routeId||c.routeId), warnings:string[]=[]
      const routeRaw=await k.route(routeId,date)
      const patternRaw=c.patternId?await safe(b.patternDetail(c.patternId),null as any,warnings,"pattern details"):null
      const geometryRaw=c.patternId?await safe(b.patternGeometry(c.patternId),null as any,warnings,"route geometry"):null
      const alertRaw=req.includeAlerts===false?{alerts:[]}:await safe(k.alerts({routeId}),{alerts:[]} as any,warnings,"alerts")
      const rt=req.includeLive===false?{vehicles:[]}:await safe(k.realtime({routeCode:c.routeCode}),{vehicles:[]} as any,warnings,"realtime")
      const stops=patternRaw?patternStops(patternRaw):[]
      let coordinates=geometryRaw?downsample(geometryCoords(geometryRaw),600):[]
      if(!coordinates.length&&stops.length) coordinates=stops.map(s=>s.coordinate).filter(Boolean) as any
      const vehicles=normalizeVehicles(rt).filter(v=>v.routeId===routeId), alerts=normalizeAlerts(alertRaw)
      const meta=(routeRaw.routes||[]).find((x:any)=>String(x.routeId)===routeId)||routeRaw.routes?.[0]
      const line={...c,...meta,routeId}
      const render={type:"line",line,stops:stops.slice(0,120),coordinates,vehicles:vehicles.slice(0,30).map(v=>({...v,onwardCalls:undefined})),alerts:alerts.slice(0,8),lastVehicleReport:rt?.lastVehicleReport}
      const facts={line:compactLine(line),stopCount:stops.length,stops:detail==="full"?stops.slice(0,30).map(compactStop):[...stops.slice(0,3),...stops.slice(-3)].map(compactStop),liveVehicleCount:vehicles.length,vehicles:vehicles.slice(0,detail==="full"?12:5).map(compactVehicle),alertCount:alerts.length,alerts:alerts.slice(0,detail==="full"?5:2).map(compactAlert),hasGeometry:coordinates.length>1}
      return {result:ok(action,facts,`קו ${c.lineNumber}: ${stops.length} תחנות, ${vehicles.length} רכבים חיים`,warnings,["BusNearby","KavNav"]),renderConfig:includeRender?render:undefined}
    }
    if(action==="line_schedule"){
      const c=await resolveLineCandidate(req), routeId=String(req.routeId||c.routeId), raw=await k.routeSchedule(routeId,date)
      const allTrips=raw.trips||[], trips=allTrips.slice(0,300), directionLabel=req.directionQuery||c.headsign
      const render={type:"schedule",scope:"line",title:`לוח קו ${c.lineNumber||""}`,date,trips,routeId,lineNumber:c.lineNumber,directionLabel,routes:[{routeId,routeNumber:c.lineNumber,color:c.color,headsign:c.headsign}],minDate:raw.minDate,maxDate:raw.maxDate,mode:"schedule"}
      const facts={line:compactLine(c),routeId,date,trips:trips.slice(0,detail==="full"?15:8).map((t:any)=>clean({tripId:t.tripId,departureTime:t.departureTime,headsign:t.headsign,shapeId:t.shapeId})),total:allTrips.length,serviceExceptions:(raw.serviceExceptions||[]).slice(0,5),minDate:raw.minDate,maxDate:raw.maxDate}
      return {result:ok(action,facts,`${trips.length} נסיעות`,undefined,["BusNearby","KavNav"]),renderConfig:includeRender?render:undefined}
    }
    if(action==="line_segment"){
      let segment=await resolveLineSegment(req), warnings:string[]=[]
      const variants:LineSegmentMatch[]=[segment,...(segment.alternatives||[])]
      const realtimeCache=new Map<string,any>()
      let live:LiveSegmentEstimate|undefined, liveSegment:LineSegmentMatch|undefined
      for(const variant of variants){
        const estimate=await liveSegmentEstimate(variant,warnings,realtimeCache)
        if(estimate&&(!live||estimate.fromMs<live.fromMs)){live=estimate;liveSegment=variant}
      }
      if(liveSegment)segment={...liveSegment,alternatives:variants.filter(v=>v!==liveSegment)}
      const routeId=String(segment.candidate.routeId)
      let scheduleSamples:ScheduledSegmentSample[]=[]
      try{scheduleSamples=scheduledSegmentSamples(await k.routeSchedule(routeId,date),date,segment.fromStop,segment.toStop)}catch(e){warnings.push(`route schedule: ${e instanceof Error?e.message:String(e)}`)}
      let scheduled=scheduledReference(scheduleSamples,live?.tripId,live?.fromMs||Date.now())
      if(!scheduled){
        try{
          const fallback=await directionsSegmentDurations(req,segment), typical=median(fallback)
          if(typical!==undefined)scheduled={durationMinutes:Math.max(1,Math.round(typical)),basis:"directions_fallback"}
        }catch(e){warnings.push(`directions fallback: ${e instanceof Error?e.message:String(e)}`)}
      }
      let recentActual:any[]=[]; let historyCollecting=false
      try{
        const history=await ensureSegmentHistory({routeId,routeCode:segment.candidate.routeCode,lineNumber:segment.candidate.lineNumber,fromStopCode:segment.fromStop.code,toStopCode:segment.toStop.code,fromStopName:segment.fromStop.name,toStopName:segment.toStop.name,pollIntervalSeconds:30})
        if(history.ok){recentActual=Array.isArray(history.data?.recentActual)?history.data.recentActual.slice(0,3):[];historyCollecting=history.data?.collecting===true}
        else warnings.push(`segment history: ${history.message}`)
      }catch(e){warnings.push(`segment history: ${e instanceof Error?e.message:String(e)}`)}
      const recentActualMedian=median(recentActual.map((x:any)=>Number(x?.durationMinutes)).filter((x:number)=>Number.isFinite(x)&&x>0))
      const scheduleDurations=scheduleSamples.map(x=>x.durationMinutes)
      const minMinutes=scheduleDurations.length?Math.max(1,Math.round(Math.min(...scheduleDurations))):scheduled?.durationMinutes
      const maxMinutes=scheduleDurations.length?Math.max(1,Math.round(Math.max(...scheduleDurations))):scheduled?.durationMinutes
      const headline=live?.durationMinutes??(recentActualMedian!==undefined?Math.max(1,Math.round(recentActualMedian)):scheduled?.durationMinutes)
      if(headline===undefined)throw new Error("לא נמצא זמן נסיעה אמין לקטע המבוקש")
      const stopCount=Math.max(2,segment.toIndex-segment.fromIndex+1)
      const currentLive=live?{durationMinutes:live.durationMinutes,vehicleId:live.vehicleId,tripId:live.tripId,fromEta:live.fromEta,toEta:live.toEta,lastReported:live.lastReported}:undefined
      const recentActualMedianMinutes=recentActualMedian===undefined?undefined:Math.max(1,Math.round(recentActualMedian))
      const source=live?"KavNav realtime":recentActual.length?"Observed realtime history":scheduled?.basis==="directions_fallback"?"BusNearby directions":"KavNav schedule"
      const render={type:"segment",lineNumber:segment.candidate.lineNumber,fromStop:segment.fromStop,toStop:segment.toStop,durationMinutes:headline,minMinutes,maxMinutes,stopCount,date,headsign:segment.candidate.headsign,source,currentLive,recentActual,recentActualMedianMinutes,scheduled,historyCollecting}
      const facts={line:compactLine(segment.candidate),from:compactStop(segment.fromStop),to:compactStop(segment.toStop),currentLive,recentActual,recentActualMedianMinutes,scheduled,historyCollecting,stopCount,date}
      const summary=live?`קו ${segment.candidate.lineNumber}: ${live.durationMinutes} דק׳ לפי האוטובוס החי הקרוב`:recentActualMedianMinutes!==undefined?`קו ${segment.candidate.lineNumber}: ${recentActualMedianMinutes} דק׳ לפי נסיעות שנמדדו בפועל`:`קו ${segment.candidate.lineNumber}: ${scheduled?.durationMinutes} דק׳ לפי לוח הזמנים`
      return {result:ok(action,facts,summary,warnings,["BusNearby","KavNav"]),renderConfig:includeRender?render:undefined}
    }
    if(action==="alerts"){
      let stopId=req.stopId, routeId=req.routeId
      if(!stopId && (req.stopCode || (req.query&&!extractLineNumber(req)))){
        const stop=await resolveStop(req)
        const ss=await k.stopSummary(stop.code)
        stopId=ss?.[0]?.stopId?String(ss[0].stopId):stop.id
      }
      if(!stopId&&!routeId){ const c=await resolveLineCandidate(req); routeId=c.routeId }
      const raw=stopId?await k.alerts({stopId}):await k.alerts({routeId:String(need(routeId,"routeId, stopId, stopCode, lineNumber, or query"))})
      const alerts=normalizeAlerts(raw).slice(0,limit), render={type:"alerts",alerts:alerts.slice(0,12)}
      const facts={alerts:alerts.slice(0,detail==="full"?12:5).map(compactAlert),total:alerts.length}
      return {result:ok(action,facts,`${alerts.length} התראות פעילות`,undefined,["KavNav"]),renderConfig:includeRender?render:undefined}
    }
    if(action==="plan_trip"){
      const fromPlace=await resolvePlace(req.fromQuery,req.fromLat,req.fromLon,req.fromName)
      const toPlace=await resolvePlace(req.toQuery,req.toLat,req.toLon,req.toName)
      const raw=await b.directions({fromPlace,toPlace,date,time:req.time,arriveBy:req.arriveBy,wheelchair:req.wheelchair,numItineraries:Math.min(limit,8)})
      const itineraries=normalizeItineraries(raw).slice(0,Math.min(limit,8))
      const render={type:"trip-plan",from:raw.plan?.from,to:raw.plan?.to,date,arriveBy:req.arriveBy??false,itineraries:itineraries.slice(0,5),areaAlerts:(raw.plan?.areaAlerts||[]).slice(0,5)}
      const facts={from:clean({name:decodeDisplayText(raw.plan?.from?.name||raw.plan?.from?.orig)}),to:clean({name:decodeDisplayText(raw.plan?.to?.name||raw.plan?.to?.orig)}),date,arriveBy:req.arriveBy??false,itineraries:itineraries.slice(0,detail==="full"?5:3).map(compactItinerary),total:itineraries.length,areaAlertCount:(raw.plan?.areaAlerts||[]).length}
      return {result:ok(action,facts,`${itineraries.length} חלופות נסיעה`,undefined,["BusNearby"]),renderConfig:includeRender?render:undefined}
    }
    if(action==="stop_pois"){
      const stop=await resolveStop(req), data=await k.stopPOIs(stop.code)
      const items=Array.isArray(data)?data:(data?.pois||[]), render={type:"raw-cards",title:`נקודות עניין ליד ${stop.name}`,items:items.slice(0,20)}
      const facts={stop:compactStop(stop),pois:items.slice(0,detail==="full"?15:8),total:items.length}
      return {result:ok(action,facts,`${items.length} נקודות עניין`,undefined,["BusNearby","KavNav"]),renderConfig:includeRender?render:undefined}
    }
    if(action==="stop_validations"){
      const stop=await resolveStop(req), data=await k.stopValidations(stop.code)
      const items=Array.isArray(data)?data:(data?.validations||[]), render={type:"raw-cards",title:`נתוני תיקופים · ${stop.name}`,items:items.slice(0,20)}
      const facts={stop:compactStop(stop),validations:items.slice(0,detail==="full"?15:8),total:items.length}
      return {result:ok(action,facts,`${items.length} רשומות תיקוף`,undefined,["BusNearby","KavNav"]),renderConfig:includeRender?render:undefined}
    }
    if(action==="shape"){
      if(req.patternId){
        const raw=await b.patternGeometry(req.patternId), coordinates=geometryCoords(raw), render={type:"shape",coordinates:downsample(coordinates,600)}
        const facts={patternId:req.patternId,pointCount:coordinates.length,boundsHint:coordinates.length?{first:coordinates[0],last:coordinates[coordinates.length-1]}:undefined}
        return {result:ok(action,facts,`${coordinates.length} נקודות מסלול`,undefined,["BusNearby"]),renderConfig:includeRender?render:undefined}
      }
      const shapeId=String(need(req.shapeId||req.query,"shapeId")), raw=await k.shape(shapeId), coordinates=shapeCoords(raw), render={type:"shape",coordinates:downsample(coordinates,600)}
      const facts={shapeId,pointCount:coordinates.length,boundsHint:coordinates.length?{first:coordinates[0],last:coordinates[coordinates.length-1]}:undefined}
      return {result:ok(action,facts,`${coordinates.length} נקודות מסלול`,undefined,["KavNav"]),renderConfig:includeRender?render:undefined}
    }
    throw new Error(`Unsupported action: ${action}`)
  } catch(e){
    const message=e instanceof Error?e.message:String(e)
    return {result:{ok:false,action,error:message}}
  }
}
export async function execute(req:TransitRequest):Promise<SkillResult>{ return (await executeInternal(req,false)).result }
export async function executeRich(req:TransitRequest):Promise<InternalTransitResult>{ return executeInternal(req,true) }
