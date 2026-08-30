import { ScrollView,VStack,Text,ZStack,Button,Image } from "scripting"
import { Props } from "./types"
import NearbyView from "./nearby-view"
import StopBoardView from "./stop-board-view"
import LineView from "./line-view"
import TripPlanView from "./trip-plan-view"
import ScheduleView from "./schedule-view"
import SegmentView from "./segment-view"
import AlertsView from "./alerts-view"
import RawCardsView from "./raw-cards-view"
import LineCandidatesView from "./line-candidates-view"
import MonitorView from "./monitor-view"
import { openSavedTripViewer } from "../scripts/lib/trip-engagement"
function TripPlanShell({config}:any){return <ZStack alignment="topTrailing"><TripPlanView {...config}/><Button action={()=>{void openSavedTripViewer().then(result=>{if(!result.ok)console.error(`Israel Transit live trip viewer: ${result.message}`)})}} buttonStyle="plain" controlSize="small" padding={{top:8,trailing:48}}><Image systemName="arrow.up.right.square" foregroundStyle="systemBlue" imageScale="medium"/></Button></ZStack>}
function Inner({config}:Props){switch(config.type){case "nearby":return <NearbyView {...config}/>;case "line-candidates":return <LineCandidatesView {...config}/>;case "stop-board":return <StopBoardView {...config}/>;case "line-live":return <LineView line={config.line} stops={config.stops||[]} coordinates={config.coordinates||[]} vehicles={config.vehicles} alerts={config.alerts||[]} liveOnly={true} lastVehicleReport={config.lastVehicleReport}/>;case "line":return <LineView {...config}/>;case "trip-plan":return <TripPlanShell config={config}/>;case "segment":return <SegmentView {...config}/>;case "schedule":return <ScheduleView {...config}/>;case "alerts":return <AlertsView alerts={config.alerts}/>;case "shape":return <NearbyView title="Route" stops={config.coordinates.map((c,i)=>({code:String(i),name:"",coordinate:c}))}/>;case "raw-cards":return <RawCardsView title={config.title} items={config.items}/>;case "monitor":return <MonitorView message={config.message} monitor={config.monitor} monitors={config.monitors}/>;default:return <VStack padding={16}><Text>Unsupported view</Text></VStack>}}
export default function TransitRenderer(props:Props){return <ScrollView><Inner {...props}/></ScrollView>}