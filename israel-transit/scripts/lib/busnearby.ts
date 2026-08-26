import { getJson, url } from "./http"
const API="https://api.busnearby.co.il"; const APP="https://app.busnearby.co.il"
export async function geocode(query:string){ return getJson<any[]>(url(API,"/geocode",{locale:"he",query}),"BusNearby geocode") }
export async function stopSearch(query:string){ return getJson<any[]>(url(APP,"/stopSearch",{query,locale:"he"}),"BusNearby stop search") }
export async function nearbyStops(lat:number,lon:number,radius=1000,max=10){ return getJson<any[]>(url(API,"/directions/index/stops",{locale:"he",radius,lat,lon,max}),"BusNearby nearby stops") }
export async function patternsByShortName(lineNumber:string){ return getJson<any[]>(url(API,`/directions/index/patterns/byshortname/${encodeURIComponent(lineNumber)}`,{locale:"he"}),"BusNearby line search") }
export async function patternsByRouteCode(routeCode:string){ return getJson<any[]>(url(API,`/directions/index/patterns/directions/${encodeURIComponent(routeCode)}`,{locale:"he"}),"BusNearby route code search") }
export async function patternDetail(patternId:string){ return getJson<any>(url(API,`/directions/index/patterns/${patternId}`,{locale:"he"}),"BusNearby pattern") }
export async function patternGeometry(patternId:string){ return getJson<any>(url(API,`/directions/index/patterns/${patternId}/geometry`),"BusNearby geometry") }
export async function directions(p:{fromPlace:string;toPlace:string;date?:string;time?:string;arriveBy?:boolean;wheelchair?:boolean;numItineraries?:number}){
  return getJson<any>(url(API,"/directions",{fromPlace:p.fromPlace,toPlace:p.toPlace,date:p.date,time:p.time,arriveBy:p.arriveBy??false,locale:"he",wheelchair:p.wheelchair??false,mode:"WALK,TRANSIT",showIntermediateStops:true,numItineraries:p.numItineraries??6,maxWalkDistance:1207,optimize:"QUICK",ignoreRealtimeUpdates:false}),"BusNearby directions")
}
