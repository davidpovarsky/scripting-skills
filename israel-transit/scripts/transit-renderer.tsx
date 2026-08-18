import { VStack, HStack, Text, Image, Spacer, useEffect, useState } from "scripting"
import { executeRich } from "./lib/transit"
import { TransitRequest } from "./lib/types"
import { saveRenderContext } from "./lib/context"
import { runSavedTripEngagement } from "./lib/trip-engagement"
import TransitRenderer from "../views/transit-renderer"
import { TransitConfig } from "../views/types"

type EngagementAction = "live" | "reminder"
type Props = Omit<Partial<TransitRequest>, "action"> & { action?: TransitRequest["action"] | "trip_engagement"; engagementAction?: EngagementAction; config?: TransitConfig }
type State = { loading:boolean; config?:TransitConfig; error?:string }
const H={loading:"\u05d8\u05d5\u05e2\u05df \u05e0\u05ea\u05d5\u05e0\u05d9 \u05ea\u05d7\u05d1\u05d5\u05e8\u05d4...",failed:"\u05dc\u05d0 \u05e0\u05d9\u05ea\u05df \u05dc\u05d4\u05e9\u05dc\u05d9\u05dd \u05d0\u05ea \u05d4\u05d1\u05e7\u05e9\u05d4",missing:"\u05dc\u05d0 \u05d4\u05ea\u05e7\u05d1\u05dc\u05d5 \u05e0\u05ea\u05d5\u05e0\u05d9\u05dd",location:"\u05d4\u05de\u05d9\u05e7\u05d5\u05dd \u05e9\u05dc\u05d9",live:"Live Activity \u05d4\u05d5\u05e4\u05e2\u05dc\u05d4",reminder:"\u05d4\u05d4\u05ea\u05e8\u05d0\u05d4 \u05ea\u05d5\u05d6\u05de\u05e0\u05d4"}
function Loading(){return <HStack padding={14} spacing={8}><Image systemName="bus.fill" foregroundStyle="systemBlue"/><Text font="subheadline">{H.loading}</Text><Spacer/></HStack>}
function ErrorCard({message}:{message:string}){return <VStack padding={14} spacing={6} alignment="trailing"><HStack><Spacer/><Image systemName="exclamationmark.triangle.fill" foregroundStyle="systemOrange"/></HStack><Text font="headline">{H.failed}</Text><Text font="caption" foregroundStyle="secondaryLabel">{message}</Text></VStack>}
function SuccessCard({message}:{message:string}){return <HStack padding={14} spacing={9}><Image systemName="checkmark.circle.fill" foregroundStyle="systemGreen"/><VStack alignment="trailing"><Text font="headline">{message}</Text><Text font="caption" foregroundStyle="secondaryLabel">Israel Transit</Text></VStack><Spacer/></HStack>}
function isCurrentLocationText(v?:string){ return /^(\u05de\u05db\u05d0\u05df|\u05db\u05d0\u05df|\u05d4\u05de\u05d9\u05e7\u05d5\u05dd \u05e9\u05dc\u05d9|my location|current location|near me)$/i.test(String(v||"").trim()) }
async function prepareRequest(props:Props):Promise<TransitRequest>{
  if(!props.action || props.action==="trip_engagement") throw new Error("Missing transit action")
  const req={...props,action:props.action} as TransitRequest
  delete (req as any).config
  delete (req as any).engagementAction
  const needsNearby=(req.action==="nearby_stops"||req.action==="nearby_line") && (!Number.isFinite(req.lat)||!Number.isFinite(req.lon))
  const needsTripOrigin=req.action==="plan_trip" && (req.useCurrentLocation===true || isCurrentLocationText(req.fromQuery)) && (!Number.isFinite(req.fromLat)||!Number.isFinite(req.fromLon))
  if(needsNearby||needsTripOrigin){
    const loc=await Location.requestCurrent()
    if(!loc) throw new Error("Current location unavailable")
    if(needsNearby){req.lat=loc.latitude;req.lon=loc.longitude}
    if(needsTripOrigin){req.fromLat=loc.latitude;req.fromLon=loc.longitude;req.fromName=req.fromName||H.location;req.fromQuery=undefined}
  }
  return req
}
function EngagementActionView({action}:{action?:EngagementAction}){
  const [loading,setLoading]=useState(true),[error,setError]=useState<string|undefined>(undefined),[done,setDone]=useState(false)
  useEffect(()=>{let active=true;void(async()=>{try{if(!action)throw new Error("Missing engagement action");const result=await runSavedTripEngagement(action);if(!active)return;if(!result.ok)setError(result.message);else setDone(true)}catch(e){if(active)setError(e instanceof Error?e.message:String(e))}finally{if(active)setLoading(false)}})();return()=>{active=false}},[action])
  if(loading)return <Loading/>
  if(error)return <ErrorCard message={error}/>
  return <SuccessCard message={action==="reminder"?H.reminder:H.live}/>
}
export default function TransitSkillView(props:Props){
  if(props.action==="trip_engagement")return <EngagementActionView action={props.engagementAction}/>
  const [state,setState]=useState<State>({loading:!props.config,config:props.config})
  useEffect(()=>{
    let active=true
    if(props.config){saveRenderContext(props.config);return()=>{active=false}}
    void (async()=>{
      try{
        const req=await prepareRequest(props)
        const bundle=await executeRich(req)
        if(!active)return
        if(!bundle.result.ok) setState({loading:false,error:bundle.result.error||"Unknown error"})
        else if(!bundle.renderConfig) setState({loading:false,error:"No rich view for this action"})
        else {const config=bundle.renderConfig as TransitConfig;saveRenderContext(config);setState({loading:false,config})}
      }catch(e){if(active)setState({loading:false,error:e instanceof Error?e.message:String(e)})}
    })()
    return()=>{active=false}
  },[])
  if(state.loading)return <Loading/>
  if(state.error)return <ErrorCard message={state.error}/>
  if(!state.config)return <ErrorCard message={H.missing}/>
  return <TransitRenderer config={state.config}/>
}
