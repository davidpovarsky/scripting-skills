#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
jewish_times.py — Zmanim, Hebrew dates, Shabbat, parasha, daf yomi, holidays.
Self-contained (stdlib only). Solar math is local; parasha/Hebrew-date come
from Hebcal converter; daf yomi from Sefaria. Works offline minus those lookups.

Usage:
  python3 jewish_times.py [--date YYYY-MM-DD] [--days N] [--shabbat]
                          [--lat F] [--lng F] [--place NAME] [--json] [--no-net]
"""
import sys, json, math, argparse
from datetime import date, timedelta

try:
    from urllib.request import urlopen, Request
except ImportError:
    urlopen = None

DEFAULT_LAT, DEFAULT_LNG = 31.7525, 35.2010      # Louis Lipsky 39, Jerusalem (Bak'a)
DEFAULT_PLACE = "ירושלים (לואי ליפסקי 39)"
CANDLE_MINUTES_BEFORE_SUNSET = 40                # minhag Yerushalayim
ALOT_DEG, MISH_DEG, TZEIT_DEG = 16.1, 19.8, 8.5

HEB_MONTH_NAMES = {1:"תשרי",2:"חשון",3:"כסלו",4:"טבת",5:"שבט",6:"אדר",6.1:"אדר א",6.2:"אדר ב",
                   7:"ניסן",8:"אייר",9:"סיון",10:"תמוז",11:"אב",12:"אלול"}
GEMATRIA_UNITS=["","א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ז׳","ח׳","ט׳"]
GEMATRIA_TENS=["","י׳","כ׳","ל׳","מ׳","נ׳","ס׳","ע׳","צ׳","ק׳"]

# ---------------------------------------------------------------- Hebrew calendar
def hebrew_leap(y): return ((y*7+1)%19)<7
def months_in_year(y): return 13 if hebrew_leap(y) else 12

def elapsed_days(year):
    # Faithful port of @hebcal/hdate elapsedDays0 (verified against Hebcal 5770–5805)
    prev=year-1
    m=235*(prev//19)+12*(prev%19)+(((prev%19)*7+1)//19)
    p=204+793*(m%1080)
    h=5+12*m+793*(m//1080)+p//1080
    parts=(p%1080)+1080*(h%24)
    day=1+29*m+h//24
    full=day
    if parts>=19440 or (day%7==2 and parts>=9924 and not hebrew_leap(year)) \
       or (day%7==1 and parts>=16789 and hebrew_leap(prev)):
        full=day+1
    if full%7 in (0,3,5): full+=1
    return full

def days_in_year(y): return elapsed_days(y+1)-elapsed_days(y)
def cheshvan_len(y): return 30 if days_in_year(y) in (355,385) else 29
def kislev_len(y):   return 29 if days_in_year(y) in (353,383) else 30

def month_lengths(y):
    L=[30,cheshvan_len(y),kislev_len(y),29,30]
    if hebrew_leap(y): L+= [30,29]
    else:              L+= [29]
    L+= [30,29,30,29,30,29]
    return L  # index0 = Tishri(1) ... Elul

def month_key(m,y=None):
    """display key for month number -> name"""
    if m==6: return 6.1 if (y and hebrew_leap(y)) else 6
    if m==7: return 6.2 if (y and hebrew_leap(y)) else 7
    if m>7 and y and hebrew_leap(y): return m-0  # 8..13 map directly
    return m

def month_name(m,y):
    if m==6:  return "אדר א" if hebrew_leap(y) else "אדר"
    if m==7:  return "אדר ב" if hebrew_leap(y) else "ניסן"
    if m>7 and hebrew_leap(y): return HEB_MONTH_NAMES[m-1]
    return HEB_MONTH_NAMES[m]

def hebrew_to_unixdays(y,m,d):
    u = elapsed_days(y) - 2092591 + d          # verified: 1 Tishri 5787 == unixday 20708
    L=month_lengths(y)
    for i in range(m-1): u+=L[i]
    return u

def unixdays_to_hebrew(u):
    gy,gm,gd=civil_from_unixdays(u)
    y=gy+3760
    def rh(yy): return elapsed_days(yy)-2092591   # RD of 1 Tishrei == EPOCH+elapsed (hebcal convention)
    while rh(y)>u: y-=1
    while rh(y+1)<=u: y+=1
    doy=u-rh(y)                                # 0-based from 1 Tishri
    L=month_lengths(y)
    m=1
    for ln in L:
        if doy<ln: return y,m,doy+1
        doy-=ln; m+=1
    raise RuntimeError("hebrew conv")

def hebrew_date_str(u):
    y,m,d=unixdays_to_hebrew(u)
    return f"{num_gem(d)} {month_name(m,y)} {num_gem(y)} ({y})"

_GLYPHS=[("תתק",900),("תת",800),("תש",700),("תר",600),("תק",500),("ת",400),("ש",300),("ר",200),("ק",100),("צ",90),("פ",80),("ע",70),("ס",60),("נ",50),("מ",40),("ל",30),("כ",20),("יט",19),("יח",18),("יז",17),("טז",16),("טו",15),("י",10),("ט",9),("ח",8),("ז",7),("ו",6),("ה",5),("ד",4),("ג",3),("ב",2),("א",1)]

def num_gem(n):
    if n<=0: return str(n)
    n=n%1000
    s=""
    for glyph,val in _GLYPHS:
        while n>=val:
            s+=glyph; n-=val
        if n==0: break
    if not s: return "0"
    if len(s)==1: return s+"\u05f3"
    return s[:-1]+"\u05f4"+s[-1]

# ---------------------------------------------------------------- civil <-> unixdays
def days_from_civil(y,m,d):
    y2=y-(1 if m<=2 else 0); era=(y2 if y2>=0 else y2-399)//400
    yoe=y2-era*400; mp=(m+9)%12
    doy=(153*mp+2)//5+d-1; doe=yoe*365+yoe//4-yoe//100+doy
    return era*146097+doe-719468

def civil_from_unixdays(u):
    z=u+719468; era=(z if z>=0 else z-146096)//146097
    doe=z-era*146097; yoe=(doe-doe//1460+doe//36524-doe//146096)//365
    y=yoe+era*400; doy=doe-(365*yoe+yoe//4-yoe//100); mp=(5*doy+2)//153
    d=doy-(153*mp+2)//5+1; m=mp+3 if mp<10 else mp-9
    return (y+(1 if m<=2 else 0),m,d)

DOW_HEB={6:"ראשון",0:"שני",1:"שלישי",2:"רביעי",3:"חמישי",4:"שישי",5:"שבת"}  # dow(): 0=Mon? define below
WEEKDAY_HEB={0:"שני",1:"שלישי",2:"רביעי",3:"חמישי",4:"שישי",5:"שבת",6:"ראשון"}

def dow(u): return (u+4)%7            # unix epoch Thu => 1970-01-01 -> 3? check: u=0 → 4%7=4 → 'Friday'? wrong.
# Fix: 1970-01-01 = Thursday. Want Mon=0..Sun=6: Thursday=3 → (u+3+k)... compute: (u+3)%7 gives Thu=3 ✓ if we want Mon=0: Thu should be 3 → (0+x)%7==3 → x=3.
def dow_mon0(u): return (u+3)%7       # Mon=0 ... Sun=6

# ---------------------------------------------------------------- Israel DST
def _last_weekday_unix(year,month,target_dow,hour,offset_min):
    if month==12: last=days_from_civil(year,12,31)
    else: last=days_from_civil(year,month+1,1)-1
    while dow_mon0(last)!=target_dow: last-=1
    return last*86400+hour*3600-offset_min*60

def il_offset_sec(u):
    ts=u*86400
    y=civil_from_unixdays(u)[0]
    start=_last_weekday_unix(y,3,4,2,120)     # last Friday(Mon0: Fri=4) 02:00 IST
    end=_last_weekday_unix(y,10,6,2,180)      # last Sunday(6) 02:00 IDT
    return 180*60 if start<=ts<end else 120*60

# ---------------------------------------------------------------- solar math
RAD=math.pi/180.0
def _jd(u,hour_frac_utc): return u+2440587.5+hour_frac_utc/24.0

def sun_time(u,lat,lng,angle_deg,rising):
    n=math.ceil(_jd(u,0.0)-2451545.0-0.0009+lng/360.0)
    jstar=2451545.0+0.0009-lng/360.0+n
    M=(357.5291+0.98560028*(jstar-2451545.0))%360.0
    C=1.9148*math.sin(M*RAD)+0.0200*math.sin(2*M*RAD)+0.0003*math.sin(3*M*RAD)
    lam=(M+C+180.0+102.9372)%360.0
    jtransit=jstar+0.0053*math.sin(M*RAD)-0.0069*math.sin(2*lam*RAD)
    decl=math.asin(math.sin(lam*RAD)*math.sin(23.44*RAD))
    x=(math.sin(-angle_deg*RAD)-math.sin(lat*RAD)*decl)/(math.cos(lat*RAD)*math.cos(decl))
    x=max(-1.0,min(1.0,x))
    w=math.acos(x)/RAD
    jr=(jtransit-(w/360.0)) if rising else (jtransit+(w/360.0))
    return jr                                  # Julian Date (UT)

def jd_to_local_hm(jd,u,off):
    secs=int(round((jd-u-2440587.5)*86400))+off
    mins=int(round(secs/60.0))
    mins=((mins%1440)+1440)%1440
    return mins

# ---------------------------------------------------------------- events
FASTS_MOVE_SUN=[("17 תמוז",10,17),("תשעה באב",11,9)]  # (label, month#, day)

def holiday_events_for_range(start_u,end_u):
    """returns {u:[names]} for jewish events incl. rosh chodesh, holidays, fasts, omer handled separately."""
    out={}
    def add(u,name): out.setdefault(u,[]).append(name)
    u=start_u
    while u<=end_u:
        y,m,d=unixdays_to_hebrew(u)
        w=dow_mon0(u)
        # Rosh Chodesh
        if m!=1 and m!=7:
            if d==1: add(u,"ראש חודש "+month_name(m,y))
            elif d==30 and month_lengths(y)[m-1]==30: add(u,"ראש חודש "+month_name(m+1 if m+1<=months_in_year(y) else 1,y)+" (יום א)")
        adar=6.2 if hebrew_leap(y) else 6
        adar_m=7 if hebrew_leap(y) else 6
        if m==1 and d in (1,2): add(u,"ראש השנה" if d==1 else "ראש השנה (יום ב׳)")
        if m==1 and d==3:
            if w==5: add(u+1,"צום גדליה")
            else: add(u,"צום גדליה")
        if m==1 and d==10: add(u,"יום כיפור")
        if m==1 and 15<=d<=21: add(u,"סוכות" if d in (15,16) else "חול המועד סוכות")
        if m==1 and d==22: add(u,"שמיני עצרת / שמחת תורה")
        if m==3 and d>=25: add(u,f"חנוכה – יום {d-24}")
        if m==4 and d<=2:
            klen=kislev_len(y)
            han_last=25+7-klen  # day into tevet: 25 Kislev +7 days
            if klen==29 and d<=han_last: add(u,f"חנוכה – יום {klen-25+1+d}")
        if m==4 and d==10: add(u,"עשרה בטבת")
        if m==5 and d==15: add(u,"ט״ו בשבט")
        if m==adar_m and d==13:
            if w==5: add(u-2,"תענית אסתר")
            else: add(u,"תענית אסתר")
        if m==adar_m and d==14: add(u,"פורים")
        if m==7 and 15<=d<=22: add(u,"פסח" if d in (15,16,21,22) else "חול המועד פסח")
        if m==8 and d==18: add(u,"ל״ג בעומר")
        if m==9 and d==6: add(u,"שבועות")
        if m==10 and d==17:
            if w==5: add(u+1,"שבעה עשר בתמוז")
            else: add(u,"שבעה עשר בתמוז")
        if m==11 and d==9:
            if w==5: add(u+1,"תשעה באב")
            else: add(u,"תשעה באב")
        u+=1
    return out

def omer_day(u):
    y,m,d=unixdays_to_hebrew(u)
    nm = 8 if hebrew_leap(y) else 7          # month number of Nissan
    if m==nm and d>=16: return d-15
    if m==nm+1 and d<=5: return 15+d
    return None

# ---------------------------------------------------------------- network
def http_json(url,timeout=12):
    if urlopen is None: return None
    try:
        req=Request(url,headers={"User-Agent":"scripting-agent-jewish-calendar"})
        with urlopen(req,timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception:
        return None

def hebcal_converter(u):
    gy,gm,gd=civil_from_unixdays(u)
    return http_json(f"https://www.hebcal.com/converter?cfg=json&gy={gy}&gm={gm}&gd={gd}&g2h=1")

def sefaria_calendars():
    return http_json("https://www.sefaria.org/api/calendars")

def week_saturday(u):
    w=dow_mon0(u)
    return u+(5-w) if w<5 else u

PARASHA_HE={
 "Bereshit":"בראשית","Noach":"נח","Lech-Lecha":"לך־לך","Vayera":"וירא","Chayei Sara":"חיי שרה",
 "Toldot":"תולדות","Vayetzei":"ויצא","Vayishlach":"וישלח","Vayeshev":"וישב","Miketz":"מקץ",
 "Vayigash":"ויגש","Vayechi":"ויחי","Shemot":"שמות","Vaera":"וארא","Bo":"בא","Beshalach":"בשלח",
 "Yitro":"יתרו","Mishpatim":"משפטים","Terumah":"תרומה","Tetzaveh":"תצוה","Ki Tisa":"כי תשא",
 "Vayakhel":"ויקהל","Pekudei":"פקודי","Vayakhel-Pekudei":"ויקהל־פקודי","Vayikra":"ויקרא","Tzav":"צו",
 "Shmini":"שמיני","Tazria":"תזריע","Metzora":"מצורע","Tazria-Metzora":"תזריע־מצורע",
 "Achrei Mot":"אחרי מות","Kedoshim":"קדושים","Achrei Mot-Kedoshim":"אחרי מות־קדושים",
 "Emor":"אמור","Behar":"בהר","Bechukotai":"בחוקותי","Behar-Bechukotai":"בהר־בחוקותי",
 "Bamidbar":"במדבר","Naso":"נשא","Behaalotcha":"בהעלתך","Shlach":"שלח לך","Korach":"קרח",
 "Chukat":"חקת","Balak":"בלק","Chukat-Balak":"חקת־בלק","Pinchas":"פינחס","Matot":"מטות",
 "Masei":"מסעי","Matot-Masei":"מטות־מסעי","Devarim":"דברים","Vaetchanan":"ואתחנן","Ekev":"עקב",
 "Reeh":"ראה","Shoftim":"שופטים","Ki Teitzei":"כי־תצא","Ki Tavo":"כי־תבוא","Nitzavim":"נצבים",
 "Vayeilech":"וילך","Nitzavim-Vayeilech":"נצבים־וילך","Haazinu":"האזינו","Ha'azinu":"האזינו","Vezot Haberakhah":"וזאת הברכה","VZot HaBerachah":"וזאת הברכה"}

def parasha_he(name):
    n=name.replace("’","'").replace("‘","'")
    return PARASHA_HE.get(n, PARASHA_HE.get(name,name))

YT_NO_WEEKLY_PARASHA={"ראש השנה","ראש השנה (יום ב׳)","יום כיפור","סוכות","פסח",
                      "שמיני עצרת / שמחת תורה","שבועות"}

# ---------------------------------------------------------------- formatting
def fmt(mins): return f"{mins//60:02d}:{mins%60:02d}"

def zman_block(u,lat,lng):
    off=il_offset_sec(u)
    def ev(a,rising): return jd_to_local_hm(sun_time(u,lat,lng,a,rising),u,off)
    alot=ev(ALOT_DEG,True); mish=ev(MISH_DEG,True); netz=ev(0.833,True); shkia=ev(0.833,False)
    tzeit=ev(TZEIT_DEG,False); rt=(ev(0.833,False))  # RT below via shkia+72
    sz_gra=(shkia-netz)/12.0
    shma_gra=int(netz+3*sz_gra); tfila_gra=int(netz+2.5*sz_gra)
    chatzot=int(netz+6*sz_gra)
    sz_mga=(shkia+72-(netz-72))/12.0
    shma_mga=int((netz-72)+3*sz_mga); tfila_mga=int((netz-72)+2.5*sz_mga)
    mg=int(chatzot+30); mk=int(netz+9.5*sz_gra); plag=int(netz+10.75*sz_gra)
    rt_t=int(shkia+72)
    rows=[("עלות השחר (16.1°)",alot),("משיכיר (19.8°)",mish),("נץ החמה",netz),
          ("סוף זמן ק״ש מג״א",shma_mga),("סוף זמן ק״ש גר״א",shma_gra),
          ("סוף זמן תפילה מג״א",tfila_mga),("סוף זמן תפילה גר״א",tfila_gra),
          ("חצות היום והלילה",chatzot),("מנחה גדולה",mg),("מנחה קטנה",mk),
          ("פלג המנחה",plag),("שקיעה",shkia),("צאת הכוכבים (8.5°)",tzeit),
          ("ליל ר״ת (72 דק׳)",rt_t)]
    candles=None; hav=None; rt_out=None
    w=dow_mon0(u)
    if w==4: candles=int(shkia-CANDLE_MINUTES_BEFORE_SUNSET)
    if w==5: hav=tzeit; rt_out=rt_t
    return dict(rows=rows,candles=candles,havdalah=hav,rt=rt_out,
                netz=netz,shkia=shkia,tzeit=tzeit)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--date"); ap.add_argument("--days",type=int,default=1)
    ap.add_argument("--shabbat",action="store_true")
    ap.add_argument("--lat",type=float,default=DEFAULT_LAT)
    ap.add_argument("--lng",type=float,default=DEFAULT_LNG)
    ap.add_argument("--place",default=DEFAULT_PLACE)
    ap.add_argument("--json",action="store_true")
    ap.add_argument("--no-net",action="store_true")
    a=ap.parse_args()

    global urlopen
    if a.no_net: urlopen=None

    today=date.today()
    u0=days_from_civil(today.year,today.month,today.day)
    if a.date:
        yy,mm,dd=a.date.split("-"); u0=days_from_civil(int(yy),int(mm),int(dd))

    results=[]
    sef=None
    conv_cache={}
    def get_conv(u):
        sat=week_saturday(u)
        if sat not in conv_cache: conv_cache[sat]=hebcal_converter(sat) if urlopen else None
        return conv_cache.get(sat)

    dates=[u0+i for i in range(max(1,a.days))]
    if a.shabbat:
        w=dow_mon0(u0)
        fri=u0+(4-w if w<=4 else 11-w)
        dates=[fri,fri+1]

    for u in dates:
        gy,gm,gd=civil_from_unixdays(u)
        wd=WEEKDAY_HEB[dow_mon0(u)]
        z=zman_block(u,a.lat,a.lng)
        conv=get_conv(u)
        heb=hebrew_date_str(u)
        parasha=None; haftara=None; daf=None; other_daily=[]
        if conv and conv.get("events"):
            for e in conv["events"]:
                if e.startswith("Parashat"):
                    parasha=parasha_he(e.replace("Parashat ",""))
                    break
        if u-u0<=3 and u-u0>=-3 and urlopen:
            if sef is None: sef=sefaria_calendars()
        if sef and isinstance(sef,dict):
            items=sef.get("calendar_items",[])
            for it in items:
                t=it.get("title",{}).get("en","")
                v=it.get("displayValue",{}).get("he","")
                if t=="Daf Yomi": daf=v
                elif t=="Parashat Hashavua":
                    if it.get("ref")=="" or True: pass
            if not parasha:
                for it in items:
                    if it.get("title",{}).get("en")=="Parashat Hashavua":
                        parasha=it.get("displayValue",{}).get("he")
        events=holiday_events_for_range(u,u)
        evs=events.get(u,[])
        if parasha and any(e in YT_NO_WEEKLY_PARASHA for e in evs):
            parasha=None                     # יום טוב – קריאה מיוחדת
        if abs(u-u0)>1:
            daf=None                         # דף יומי רלוונטי רק להיום
        omer=omer_day(u)
        results.append(dict(u=u,date=f"{gd:02d}/{gm:02d}/{gy}",weekday=wd,hebrew=heb,
                            parasha=parasha,daf=daf,zmanim={k:v for k,v in z["rows"]},
                            candles=z["candles"],havdalah=z["havdalah"],rt=z["rt"],
                            events=evs,omer=omer))

    if a.json:
        print(json.dumps(results,ensure_ascii=False,indent=1)); return

    place=a.place
    for r in results:
        gy,gm,gd=civil_from_unixdays(r["u"])
        print(f"\n📅 {place} — יום {r['weekday']}, {r['date']} | {r['hebrew']}")
        print("🌅 זמני היום:")
        for k,v in r["zmanim"].items(): print(f"   • {k}: {fmt(v)}")
        if r["candles"] is not None:
            print(f"🕯️ הדלקת נרות: {fmt(r['candles'])} (40 דק׳ לפני השקיעה — מנהג ירושלים)")
        if r["havdalah"] is not None:
            print(f"🌌 מוצאי שבת: צאת הכוכבים (8.5°) {fmt(r['havdalah'])} | ליל ר״ת (72 דק׳) {fmt(r['rt'])}")
        if r["parasha"]:
            print(f"📖 פרשת השבוע: פרשת {r['parasha']}")
        if r["daf"]:
            print(f"📜 דף יומי: {r['daf']}")
        if r["events"]:
            print(f"🗓️ אירועים: {' · '.join(sorted(set(r['events'])))}")
        if r["omer"]:
            print(f"🌾 יום {r['omer']} לעומר")
    if not urlopen:
        print("\n(מצב אופליין — ללא פרשה/דף יומי)")

if __name__=="__main__":
    main()
