import { Alert, Coordinate, Departure, Itinerary, Leg, LineCandidate, Stop, Vehicle } from "./types"
import { decodePolyline } from "./polyline"
import { formatClock, isoToMs, minutesFromNow, scheduleMs } from "./time"
const n=(v:any)=>typeof v==="number"?v:Number(v)
const coord=(lat:any,lon:any):Coordinate|undefined=>Number.isFinite(n(lat))&&Number.isFinite(n(lon))?{latitude:n(lat),longitude:n(lon)}:undefined
const stripFeed=(id:any)=>String(id??"").replace(/^1:/,"")

export function decodeDisplayText(value:any): string {
  let text=String(value ?? "")
  if (!text) return ""
  // Some upstream payloads occasionally contain JSON-style escapes as literal text.
  // Decode only display-safe escape sequences; leave ordinary backslashes untouched.
  for (let pass=0; pass<2; pass++) {
    const next=text
      .replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (_m, hex) => {
        const cp=parseInt(hex,16)
        return Number.isFinite(cp) && cp<=0x10ffff ? String.fromCodePoint(cp) : _m
      })
      .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) => String.fromCharCode(parseInt(hex,16)))
      .replace(/\\x([0-9a-fA-F]{2})/g, (_m, hex) => String.fromCharCode(parseInt(hex,16)))
    if (next===text) break
    text=next
  }
  return text
}
export function downsample<T>(items:T[],max=500):T[]{ if(items.length<=max)return items; const out:T[]=[]; const step=(items.length-1)/(max-1); for(let i=0;i<max;i++) out.push(items[Math.round(i*step)]); return out }
export function normalizeStop(x:any):Stop { return {id:stripFeed(x.id||x.stop_id||x.stopId)||undefined,code:String(x.code||x.stop_code||x.stopCode||""),name:decodeDisplayText(x.name||x.stop_name||x.stopName||x.description||"תחנה"),address:decodeDisplayText(x.address||x.formatted_address||x.desc)||undefined,city:decodeDisplayText(x.city)||undefined,coordinate:coord(x.lat??x.latitude,x.lon??x.lng??x.longitude),distanceMeters:Number.isFinite(n(x.distance??x.dist))?n(x.distance??x.dist):undefined,heading:Number.isFinite(n(x.heading))?n(x.heading):undefined} }
export function normalizeNearby(xs:any[]):Stop[]{ return xs.map(normalizeStop).filter(s=>s.code) }
export function normalizePatterns(xs:any[]):LineCandidate[]{ return xs.map(x=>({patternId:x.id||x.patternId,routeId:stripFeed(x.route?.id||x.routeId||x.route),lineNumber:decodeDisplayText(x.route?.shortName||x.line||""),routeCode:String(x.route?.motLineId||x.motLineId||"")||undefined,agency:decodeDisplayText(x.route?.agency?.name||x.agency_name)||undefined,agencyId:String(x.route?.agency?.id||x.operator||"")||undefined,headsign:decodeDisplayText(x.headsign||x.route?.longName)||undefined,origin:x.originStop?normalizeStop(x.originStop):undefined,destination:x.destStop?normalizeStop(x.destStop):undefined,direction:decodeDisplayText(x.route?.motDirection||x.motDirection||x.direction)||undefined,alternative:decodeDisplayText(x.route?.motAlternative||x.motAlternative||x.alternative)||undefined,color:x.route?.color?`#${String(x.route.color).replace(/^#/,"")}`:x.route_color,longName:decodeDisplayText(x.route?.longName||x.route_long_name)||undefined})) }
export function normalizeVehicles(raw:any,targetStopCode?:string):Vehicle[]{
  return (raw?.vehicles||[]).map((v:any)=>{ const calls=v.trip?.onwardCalls?.calls||[]; const call=targetStopCode?calls.find((c:any)=>String(c.stopCode)===String(targetStopCode)):undefined; const eta=isoToMs(call?.eta); return {vehicleId:String(v.vehicleId||""),tripId:String(v.trip?.gtfsInfo?.tripId||"")||undefined,routeId:String(v.trip?.routeId||""),routeCode:v.trip?.gtfsInfo?.routeDesc?.split("-")?.[0],lineNumber:decodeDisplayText(v.trip?.gtfsInfo?.routeNumber),destination:decodeDisplayText(v.trip?.gtfsInfo?.headsign)||undefined,coordinate:coord(v.geo?.location?.lat,v.geo?.location?.lon),speedKmh:v.geo?.speed,bearing:v.geo?.bearing,lastReported:v.lastReported,confidence:v.trip?.confidenceLevel,nextStopCode:v.trip?.nextCall?.stopCode,etaAtTarget:call?.eta,minutesToTarget:minutesFromNow(eta),delayMinutes:v.trip?.departure?.delayMinutes,shapeId:v.trip?.gtfsInfo?.shapeId,onwardCalls:calls.slice(0,30).map((c:any)=>({stopCode:String(c.stopCode),stopSeq:c.stopSeq,eta:c.eta}))} as Vehicle }).filter((v:Vehicle)=>!targetStopCode||!!v.etaAtTarget)
}
export function normalizeAlerts(raw:any):Alert[]{ return (raw?.alerts||[]).filter((a:any)=>!a.isDeleted).map((a:any)=>({id:String(a.alertId||a.id||""),title:decodeDisplayText(a.header?.he||a.header?.en||a.title||"התראת שירות"),description:decodeDisplayText(a.description?.he||a.description?.en||a.description)||undefined,cause:decodeDisplayText(a.cause)||undefined,effect:decodeDisplayText(a.effect)||undefined,start:a.minStartAt||a.activePeriods?.[0]?.start,end:a.maxEndAt||a.activePeriods?.[0]?.end,routeIds:(a.entities||[]).map((e:any)=>e.routeId).filter(Boolean),stopIds:(a.entities||[]).map((e:any)=>e.stopId).filter(Boolean),active:!a.isDeleted})) }
export function scheduleTrips(raw:any):any[]{ const s=raw?.stopSchedule; if(Array.isArray(s)&&s[0]?.trips) return s[0].trips; return [] }
export function mergeStopBoard(stopCode:string,date:string,summary:any[],schedule:any,realtime:any,limit=20):{routes:any[];departures:Departure[];vehicles:Vehicle[]}{
  const routes=summary?.[0]?.routes||[]; const byRoute=new Map<string,any>(routes.map((r:any)=>[String(r.routeId),r])); const vehicles=normalizeVehicles(realtime,stopCode); const liveByTrip=new Map<string,Vehicle>();
  for(const v of vehicles){ const raw=(realtime?.vehicles||[]).find((x:any)=>String(x.vehicleId)===v.vehicleId); const trip=raw?.trip?.gtfsInfo?.tripId; if(trip) liveByTrip.set(String(trip),v) }
  const deps:Departure[]=[]; const seen=new Set<string>()
  for(const t of scheduleTrips(schedule)){
    const route=byRoute.get(String(t.routeId)); const live=liveByTrip.get(String(t.tripId)); const planned=scheduleMs(t.operationalDate||date,t.departureTime); const predicted=live?.etaAtTarget?isoToMs(live.etaAtTarget):undefined; const eventMs=predicted??planned; const key=String(t.tripId)
    if(seen.has(key)) continue
    if(eventMs!==undefined && eventMs<Date.now()-90000) continue
    seen.add(key)
    deps.push({tripId:key,routeId:String(t.routeId),routeCode:route?.code,lineNumber:decodeDisplayText(route?.routeNumber||""),destination:decodeDisplayText(t.headsign||route?.headsign)||undefined,scheduledTime:formatClock(planned),predictedTime:formatClock(predicted),minutes:minutesFromNow(eventMs),delayMinutes:live?.delayMinutes,realtime:!!live,confidence:live?.confidence,vehicleId:live?.vehicleId,lastReported:live?.lastReported,accessible:t.wheelchairAccessible===true||t.accessible===true})
  }
  for(const v of vehicles){ if(!v.etaAtTarget) continue; const raw=(realtime?.vehicles||[]).find((x:any)=>String(x.vehicleId)===v.vehicleId); const trip=String(raw?.trip?.gtfsInfo?.tripId||""); if(trip&&seen.has(trip)) continue; const route=byRoute.get(String(v.routeId)); deps.push({tripId:trip||undefined,routeId:v.routeId,routeCode:route?.code,lineNumber:v.lineNumber||route?.routeNumber,destination:decodeDisplayText(v.destination||route?.headsign)||undefined,predictedTime:formatClock(isoToMs(v.etaAtTarget)),minutes:v.minutesToTarget,delayMinutes:v.delayMinutes,realtime:true,confidence:v.confidence,vehicleId:v.vehicleId,lastReported:v.lastReported,accessible:raw?.trip?.wheelchairAccessible===true}) }
  deps.sort((a,b)=>(a.minutes??99999)-(b.minutes??99999)); return {routes,departures:deps.slice(0,limit),vehicles}
}
export function patternStops(raw:any):Stop[]{ const data=Array.isArray(raw)?raw[0]:raw; return (data?.stops||[]).map(normalizeStop) }
export function geometryCoords(raw:any):Coordinate[]{ if(Array.isArray(raw)) return raw.map((p:any)=>coord(p.lat??p.latitude,p.lon??p.longitude)).filter(Boolean) as Coordinate[]; if(raw?.points6) return decodePolyline(raw.points6,6); if(Array.isArray(raw?.coordinates)) return raw.coordinates.map((p:any)=>Array.isArray(p)?coord(p[1],p[0]):coord(p.lat??p.latitude,p.lon??p.longitude)).filter(Boolean) as Coordinate[]; return [] }
export function shapeCoords(raw:any):Coordinate[]{ if(Array.isArray(raw)) return raw.map((p:any)=>Array.isArray(p)?coord(p[1],p[0]):coord(p.lat??p.latitude,p.lon??p.longitude)).filter(Boolean) as Coordinate[]; if(raw?.points6) return decodePolyline(raw.points6,6); if(Array.isArray(raw?.shape)) return shapeCoords(raw.shape); if(Array.isArray(raw?.coordinates)) return shapeCoords(raw.coordinates); return [] }
export function normalizeItineraries(raw:any):Itinerary[]{ const its=raw?.plan?.itineraries||[]; return its.map((it:any,index:number)=>({index,durationSeconds:it.duration||0,startTime:it.startTime,endTime:it.endTime,walkSeconds:it.walkTime,waitingSeconds:it.waitingTime,walkDistanceMeters:it.walkDistance,transfers:it.transfers,fare:it.fare?.fare?.regular?{amount:(it.fare.fare.regular.cents||0)/100,currency:it.fare.fare.regular.currency?.currencyCode||"ILS",symbol:it.fare.fare.regular.currency?.symbol}:undefined,legs:(it.legs||[]).map((l:any)=>({mode:String(l.mode||""),route:decodeDisplayText(l.routeShortName||l.route)||undefined,agency:decodeDisplayText(l.agencyName)||undefined,headsign:decodeDisplayText(l.headsign)||undefined,from:{name:decodeDisplayText(l.from?.name||""),coordinate:coord(l.from?.lat,l.from?.lon),stopCode:l.from?.stopCode},to:{name:decodeDisplayText(l.to?.name||""),coordinate:coord(l.to?.lat,l.to?.lon),stopCode:l.to?.stopCode},startTime:l.startTime,endTime:l.endTime,durationSeconds:l.duration,distanceMeters:l.distance,realtime:!!l.realTime,wheelchairAccessible:!!l.wheelchairAccessible,color:l.routeColor?`#${String(l.routeColor).replace(/^#/,"")}`:undefined,coordinates:l.legGeometry?.points6?downsample(decodePolyline(l.legGeometry.points6,6),260):undefined,routeId:stripFeed(l.routeId),tripId:stripFeed(l.tripId),agencyId:String(l.agencyId||"")||undefined,intermediateStops:(l.intermediateStops||[]).map(normalizeStop),steps:(l.steps||[]).slice(0,40).map((s:any)=>({distanceMeters:s.distance,durationSeconds:s.duration,direction:s.relativeDirection,streetName:decodeDisplayText(s.nativeStreetName||s.streetName)||undefined,latitude:s.lat,longitude:s.lon}))} as Leg))})) }
