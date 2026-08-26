import { Coordinate } from "./types"
export function decodePolyline(encoded:string, precision=6):Coordinate[]{
  let index=0, lat=0, lon=0; const factor=Math.pow(10,precision); const out:Coordinate[]=[]
  while(index<encoded.length){
    let result=0,shift=0,b:number
    do { b=encoded.charCodeAt(index++)-63; result|=(b&0x1f)<<shift; shift+=5 } while(b>=0x20 && index<=encoded.length)
    lat += (result&1) ? ~(result>>1) : (result>>1)
    result=0; shift=0
    do { b=encoded.charCodeAt(index++)-63; result|=(b&0x1f)<<shift; shift+=5 } while(b>=0x20 && index<=encoded.length)
    lon += (result&1) ? ~(result>>1) : (result>>1)
    out.push({latitude:lat/factor,longitude:lon/factor})
  }
  return out
}
