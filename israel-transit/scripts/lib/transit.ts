import { TransitRequest, SkillResult, Stop, LineCandidate, InternalTransitResult, Departure, Vehicle, Alert, Itinerary } from "./types"
import * as b from "./busnearby"
import * as k from "./kavnav"
import { decodeDisplayText, downsample, geometryCoords, mergeStopBoard, normalizeAlerts, normalizeItineraries, normalizeNearby, normalizePatterns, normalizeStop, normalizeVehicles, patternStops, scheduleTrips, shapeCoords } from "./normalize"
import { scheduleMs, todayJerusalem } from "./time"
import { resolveContextLine } from "./context"

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
function compactDeparture(d:Departure){ return clean({line:d.lineNumber,destination:d.destination,minutes:d.minutes,realtime:d.realtime,scheduledTime:d.scheduledTime,predictedTime:d.predictedTime,delayMinutes:d.delayMinutes,confidence:d.confidence}) }
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
      const render={type:"stop-board",stop:resolvedStop,date,routes:board.routes,departures:board.departures,vehicles:board.vehicles.slice(0,20).map(v=>({...v,onwardCalls:undefined})),alerts:alerts.slice(0,8),lastVehicleReport:rt?.lastVehicleReport,neighbors:(meta.neighbors||[]).slice(0,20),restrictions:meta.restrictions||{},lineFilter:lineNumber,routeIdFilter:[...routeIds]}
      const facts={lineNumber,direction:directionQuery||selectedRoutes[0]?.headsign,stop:compactStop(resolvedStop),departures:board.departures.slice(0,detail==="full"?12:6).map(compactDeparture),liveVehicleCount:board.vehicles.length,nearbyStopsChecked:stops.length,date}
      return {result:ok(action,facts,`${board.departures.length} הגעות קרובות לקו ${lineNumber}`,warnings,["BusNearby","KavNav"]),renderConfig:includeRender?render:undefined}
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
      const stop={id:String(stopId||""),code:stopCode,name:decodeDisplayText(meta.stopName||meta.name||resolved.name||`תחנה ${stopCode}`),address:resolved.address,coordinate:resolved.coordinate}
      const render={type:"stop-board",stop,date,routes:board.routes.slice(0,30),departures:board.departures,vehicles:board.vehicles.slice(0,20).map(v=>({...v,onwardCalls:undefined})),alerts:alerts.slice(0,8),lastVehicleReport:rt?.lastVehicleReport,neighbors:(meta.neighbors||[]).slice(0,20),restrictions:meta.restrictions||{}}
      const facts={stop,departures:board.departures.slice(0,detail==="full"?15:8).map(compactDeparture),routeCount:board.routes.length,liveVehicleCount:board.vehicles.length,alertCount:alerts.length,alerts:alerts.slice(0,detail==="full"?5:2).map(compactAlert),lastVehicleReport:rt?.lastVehicleReport,date}
      return {result:ok(action,facts,`${board.departures.length} יציאות קרובות`,warnings,["BusNearby","KavNav"]),renderConfig:includeRender?render:undefined}
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
