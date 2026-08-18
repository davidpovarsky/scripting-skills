export const JERUSALEM_TZ="Asia/Jerusalem"
export function todayJerusalem():string { return new Intl.DateTimeFormat("en-CA",{timeZone:JERUSALEM_TZ,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()) }
export function nowMs():number { return Date.now() }
export function isoToMs(value?:string):number|undefined { if(!value) return undefined; const n=Date.parse(value); return Number.isFinite(n)?n:undefined }
export function scheduleMs(date:string,time?:string):number|undefined{
  if(!time) return undefined
  const [y,m,d]=date.split("-").map(Number); const [hh,mm,ss]=time.split(":").map(Number)
  // Israel offset varies; construct through an ISO approximation and correct using Intl parts.
  const naive=Date.UTC(y,m-1,d,hh||0,mm||0,ss||0)
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:JERUSALEM_TZ,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date(naive))
  const get=(t:string)=>Number(parts.find(p=>p.type===t)?.value||0)
  const rendered=Date.UTC(get("year"),get("month")-1,get("day"),get("hour"),get("minute"),get("second"))
  return naive-(rendered-naive)
}
export function minutesFromNow(ms?:number):number|undefined { return ms===undefined?undefined:Math.max(0,Math.round((ms-Date.now())/60000)) }
export function formatClock(ms?:number):string|undefined { if(ms===undefined) return undefined; return new Intl.DateTimeFormat("he-IL",{timeZone:JERUSALEM_TZ,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(ms)) }

export function formatArrivalHe(value?:number,clock?:string,nowLabel="כעת"):string {
  if(value===undefined||!Number.isFinite(value)) return clock||"—"
  const m=Math.max(0,Math.round(value))
  if(m<=0) return nowLabel
  if(m<60) return `${m} דק׳`
  return clock||formatClock(Date.now()+m*60000)||"—"
}

export function formatMinutesHe(value?:number,nowLabel="כעת"):string {
  if(value===undefined||!Number.isFinite(value)) return "—"
  const m=Math.max(0,Math.round(value))
  if(m<=0) return nowLabel
  if(m<60) return `${m} דק׳`
  const h=Math.floor(m/60), rest=m%60
  const hours=h===1?"שעה":h===2?"שעתיים":`${h} שעות`
  return rest?`${hours} ו־${rest} דק׳`:hours
}
