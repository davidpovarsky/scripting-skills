import { getJson, url } from "./http"
const BASE="https://kavnav.com"
export const realtime=(q:{stopCode?:string;routeCode?:string})=>getJson<any>(url(BASE,"/api/realtime",q),"KavNav realtime")
export const stopSummary=(stopCode:string)=>getJson<any[]>(url(BASE,"/api/stopSummary",{stopCode}),"KavNav stop summary")
export const stopSchedule=(stopCode:string,date:string)=>getJson<any>(url(BASE,"/api/stopSchedule",{stopCode,date}),"KavNav stop schedule")
export const alerts=(q:{stopId?:string;routeId?:string})=>getJson<any>(url(BASE,"/api/alerts",q),"KavNav alerts")
export const route=(routeId:string,date:string)=>getJson<any>(url(BASE,"/api/route",{routeId,date}),"KavNav route")
export const routeSchedule=(routeId:string,date:string)=>getJson<any>(url(BASE,"/api/routeSchedule",{routeId,date}),"KavNav route schedule")
export const shape=(shapeId:string)=>getJson<any>(url(BASE,`/shapes/${encodeURIComponent(shapeId)}.json`),"KavNav shape")
export const stopPOIs=(stopCode:string)=>getJson<any>(url(BASE,"/api/stopPOIs",{stopCode}),"KavNav stop POIs")

export const stopValidations=(stopCode:string)=>getJson<any>(url(BASE,"/api/stopValidations",{stopCode}),"KavNav stop validations")
