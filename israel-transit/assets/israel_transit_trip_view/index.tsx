import { Image,Navigation,NavigationStack,Script,ScrollView,Text,VStack } from "scripting"
import TripPlanView from "./views/trip-plan-view"
import type { Itinerary } from "./views/types"

type TripPlanPayload={
  kind?:string
  from:any
  to:any
  itineraries:Itinerary[]
  selectedIndex?:number
  date?:string
  time?:string
  arriveBy?:boolean
  height?:number
}

function loadPlan():TripPlanPayload|null{
  try{
    const raw=Script.queryParameters?.payload
    if(!raw)return null
    const parsed=JSON.parse(String(raw))
    if(!parsed||!Array.isArray(parsed.itineraries)||!parsed.itineraries.length)return null
    return parsed
  }catch{return null}
}

async function main(){
  const plan=loadPlan()
  if(!plan){
    await Navigation.present({element:<NavigationStack><VStack spacing={10} padding={24}><Image systemName="exclamationmark.triangle.fill" font="title" foregroundStyle="systemOrange"/><Text font="headline">אין מסלול שמור</Text><Text font="caption" foregroundStyle="secondaryLabel">פתח מסלול דרך ה-Agent ולחץ שוב על אייקון הפתיחה.</Text></VStack></NavigationStack>})
    Script.exit()
    return
  }
  await Navigation.present({element:<NavigationStack><ScrollView><TripPlanView from={plan.from} to={plan.to} itineraries={plan.itineraries} initialSelectedIndex={plan.selectedIndex||0} date={plan.date} time={plan.time} arriveBy={plan.arriveBy===true} height={plan.height||260} liveMode={true} showOpenInScript={false}/></ScrollView></NavigationStack>})
  Script.exit()
}
void main()