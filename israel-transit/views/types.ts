export type Coordinate={latitude:number;longitude:number}
export type Stop={id?:string;code:string;name:string;address?:string;city?:string;coordinate?:Coordinate;distanceMeters?:number;heading?:number;routes?:any[];nextLive?:Vehicle[]}
export type Vehicle={vehicleId:string;routeId?:string;routeCode?:string;lineNumber?:string;destination?:string;coordinate?:Coordinate;speedKmh?:number;bearing?:number;lastReported?:string;confidence?:string;nextStopCode?:string;etaAtTarget?:string;minutesToTarget?:number;delayMinutes?:number;shapeId?:string;onwardCalls?:{stopCode:string;stopSeq?:number;eta?:string}[]}
export type Departure={tripId?:string;routeId?:string;routeCode?:string;lineNumber?:string;destination?:string;scheduledTime?:string;predictedTime?:string;minutes?:number;delayMinutes?:number;realtime:boolean;confidence?:string;vehicleId?:string;lastReported?:string}
export type Alert={id:string;title:string;description?:string;cause?:string;effect?:string;start?:string;end?:string;routeIds?:string[];stopIds?:string[]}
export type Line={patternId?:string;routeId:string;lineNumber?:string;routeNumber?:string;routeCode?:string;code?:string;agency?:string;operatorId?:string;headsign?:string;direction?:string;alternative?:string;color?:string;routeLongName?:string;longName?:string}
export type Leg={mode:string;route?:string;agency?:string;headsign?:string;from:{name:string;coordinate?:Coordinate;stopCode?:string};to:{name:string;coordinate?:Coordinate;stopCode?:string};startTime?:number;endTime?:number;durationSeconds?:number;distanceMeters?:number;realtime?:boolean;wheelchairAccessible?:boolean;color?:string;coordinates?:Coordinate[];routeId?:string;tripId?:string;agencyId?:string;intermediateStops?:Stop[];steps?:any[]}
export type Itinerary={index:number;durationSeconds:number;startTime:number;endTime:number;walkSeconds?:number;waitingSeconds?:number;walkDistanceMeters?:number;transfers?:number;fare?:{amount:number;currency:string;symbol?:string};legs:Leg[]}
export type TransitConfig =
 | {type:"nearby";title?:string;userCoordinate?:Coordinate;stops:Stop[];height?:number}
 | {type:"line-candidates";title?:string;lines:Line[];height?:number}
 | {type:"stop-board";stop:Stop;date:string;routes:any[];departures:Departure[];vehicles:Vehicle[];alerts:Alert[];lastVehicleReport?:string;neighbors?:any[];restrictions?:any;headways?:any[];lineFilter?:string;routeIdFilter?:string[];height?:number}
 | {type:"line-live";line:Line;stops?:Stop[];coordinates?:Coordinate[];vehicles:Vehicle[];alerts?:Alert[];lastVehicleReport?:string;height?:number}
 | {type:"line";line:Line;stops:Stop[];coordinates:Coordinate[];vehicles:Vehicle[];alerts:Alert[];routeChanges?:any[];lastVehicleReport?:string;liveOnly?:boolean;height?:number}
 | {type:"trip-plan";from:any;to:any;date?:string;time?:string;arriveBy?:boolean;itineraries:Itinerary[];areaAlerts?:any[];height?:number}
 | {type:"schedule";scope:"stop"|"line"|"nearby-line";title?:string;date:string;trips:any[];stopCode?:string;routeId?:string;routeIds?:string[];lineNumber?:string;directionLabel?:string;routes?:any[];minDate?:string;maxDate?:string;mode?:"schedule"|"last"|"first";height?:number}
 | {type:"alerts";alerts:Alert[];height?:number}
 | {type:"shape";coordinates:Coordinate[];height?:number}
 | {type:"raw-cards";title?:string;items:any[];height?:number}
export type Props={config:TransitConfig}
