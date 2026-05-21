import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { io } from "socket.io-client";

const S=360,CX=180,CY=180,R=134,LR=158;
function pt(deg,r=R){const a=(deg-90)*Math.PI/180;return[CX+r*Math.cos(a),CY+r*Math.sin(a)];}
function pStr(pts){return pts.map(p=>p.join(",")).join(" ");}

const ABJAD={"ا":1,"أ":1,"إ":1,"آ":1,"ء":1,"ئ":10,"ؤ":6,"ب":2,"ت":400,"ث":500,"ج":3,"ح":8,"خ":600,"د":4,"ذ":700,"ر":200,"ز":7,"س":60,"ش":300,"ص":90,"ض":800,"ط":9,"ظ":900,"ع":70,"غ":1000,"ف":80,"ق":100,"ك":20,"ل":30,"م":40,"ن":50,"ه":5,"و":6,"ي":10,"ى":10,"ة":400};
const abj=t=>[...t].reduce((s,c)=>s+(ABJAD[c]||0),0);
const reduce=n=>{let r=n;while(r>9)r=[...String(r)].reduce((s,d)=>s+(+d),0);return r;};
function perms(a){if(a.length<=1)return[a];return a.flatMap((v,i)=>perms([...a.slice(0,i),...a.slice(i+1)]).map(p=>[v,...p]));}

const ARCH={1:"Unité",2:"Porte",3:"Miséricorde",4:"Science",5:"Souffle",6:"Lien d'Amour",7:"Perfection",8:"Équilibre",9:"Complétude"};
const ROOT_L={1:"ا",2:"ب",3:"ج",4:"د",5:"ه",6:"و",7:"ز",8:"ح",9:"ط"};

const VERTEX=[
  {l:"ا",n:"Alif",v:1,deg:0,tri:"e"},{l:"ل",n:"Lâm",v:30,deg:60,tri:"m"},
  {l:"ه",n:"Hâ",v:5,deg:120,tri:"e"},{l:"م",n:"Mîm",v:40,deg:180,tri:"m"},
  {l:"و",n:"Wâw",v:6,deg:240,tri:"e"},{l:"ن",n:"Nûn",v:50,deg:300,tri:"m"},
];
const ARC=[
  {l:"ب",n:"Bâ",v:2,deg:348},{l:"ج",n:"Jîm",v:3,deg:336},{l:"د",n:"Dâl",v:4,deg:324},{l:"ز",n:"Zayn",v:7,deg:312},
  {l:"ح",n:"Hâ",v:8,deg:288},{l:"ط",n:"Tâ",v:9,deg:276},{l:"ي",n:"Yâ",v:10,deg:264},{l:"ك",n:"Kâf",v:20,deg:252},
  {l:"س",n:"Sîn",v:60,deg:228},{l:"ع",n:"Ayn",v:70,deg:216},{l:"ف",n:"Fâ",v:80,deg:204},{l:"ص",n:"Sâd",v:90,deg:192},
  {l:"ق",n:"Qâf",v:100,deg:168},{l:"ر",n:"Râ",v:200,deg:156},{l:"ش",n:"Shîn",v:300,deg:144},{l:"ت",n:"Tâ",v:400,deg:132},
  {l:"ث",n:"Thâ",v:500,deg:105},{l:"خ",n:"Khâ",v:600,deg:90},{l:"ذ",n:"Dhâl",v:700,deg:75},{l:"ض",n:"Dâd",v:800,deg:45},
  {l:"ظ",n:"Zâ",v:900,deg:30},{l:"غ",n:"Ghayn",v:1000,deg:15},
];
const ALL=[...VERTEX,...ARC];

const N99=[
  {ar:"الله",tr:"Allâh",fr:"Le Dieu"},{ar:"الرحمن",tr:"Ar-Rahmân",fr:"Le Tout Miséricordieux"},
  {ar:"الرحيم",tr:"Ar-Rahîm",fr:"Le Très Miséricordieux"},{ar:"الملك",tr:"Al-Malik",fr:"Le Roi Absolu"},
  {ar:"القدوس",tr:"Al-Quddûs",fr:"Le Pur Saint"},{ar:"السلام",tr:"As-Salâm",fr:"La Paix"},
  {ar:"المؤمن",tr:"Al-Mumin",fr:"Donneur de Foi"},{ar:"المهيمن",tr:"Al-Muhaymin",fr:"Le Gardien Suprême"},
  {ar:"العزيز",tr:"Al-Aziz",fr:"Le Tout Puissant"},{ar:"الجبار",tr:"Al-Jabbâr",fr:"Le Contraignant"},
  {ar:"المتكبر",tr:"Al-Mutakabbir",fr:"Le Sublime"},{ar:"الخالق",tr:"Al-Khâliq",fr:"Le Créateur"},
  {ar:"البارئ",tr:"Al-Bâri",fr:"Le Producteur"},{ar:"المصور",tr:"Al-Musawwir",fr:"Le Formateur"},
  {ar:"الغفار",tr:"Al-Ghaffâr",fr:"Le Grand Pardonneur"},{ar:"القهار",tr:"Al-Qahhâr",fr:"Le Dominateur"},
  {ar:"الوهاب",tr:"Al-Wahhâb",fr:"Le Grand Donateur"},{ar:"الرزاق",tr:"Ar-Razzâq",fr:"Le Pourvoyeur"},
  {ar:"الفتاح",tr:"Al-Fattâh",fr:"L'Ouvreur des Portes"},{ar:"العليم",tr:"Al-Alim",fr:"L'Omniscient"},
  {ar:"القابض",tr:"Al-Qâbid",fr:"Celui qui resserre"},{ar:"الباسط",tr:"Al-Bâsit",fr:"Celui qui étend"},
  {ar:"الخافض",tr:"Al-Khâfid",fr:"L'Abaisseur"},{ar:"الرافع",tr:"Ar-Râfi",fr:"L'Élévateur"},
  {ar:"المعز",tr:"Al-Muizz",fr:"Celui qui honore"},{ar:"المذل",tr:"Al-Mudhill",fr:"Celui qui humilie"},
  {ar:"السميع",tr:"As-Samî",fr:"L'Audient"},{ar:"البصير",tr:"Al-Basîr",fr:"Le Clairvoyant"},
  {ar:"الحكم",tr:"Al-Hakam",fr:"Le Juge Suprême"},{ar:"العدل",tr:"Al-Adl",fr:"Le Juste"},
  {ar:"اللطيف",tr:"Al-Latîf",fr:"Le Subtil"},{ar:"الخبير",tr:"Al-Khabîr",fr:"Le Parfaitement Informé"},
  {ar:"الحليم",tr:"Al-Halîm",fr:"Le Très Clément"},{ar:"العظيم",tr:"Al-Azim",fr:"Le Magnifique"},
  {ar:"الغفور",tr:"Al-Ghafûr",fr:"Le Très Pardonneur"},{ar:"الشكور",tr:"Ash-Shakûr",fr:"Le Reconnaissant"},
  {ar:"العلي",tr:"Al-Ali",fr:"Le Très Haut"},{ar:"الكبير",tr:"Al-Kabîr",fr:"Le Grand"},
  {ar:"الحفيظ",tr:"Al-Hafiz",fr:"Le Gardien"},{ar:"المقيت",tr:"Al-Muqit",fr:"Le Nourricier"},
  {ar:"الحسيب",tr:"Al-Hasib",fr:"Le Comptable"},{ar:"الجليل",tr:"Al-Jalil",fr:"Le Majestueux"},
  {ar:"الكريم",tr:"Al-Karim",fr:"Le Généreux"},{ar:"الرقيب",tr:"Ar-Raqib",fr:"Le Vigilant"},
  {ar:"المجيب",tr:"Al-Mujib",fr:"Celui qui répond"},{ar:"الواسع",tr:"Al-Wâsi",fr:"L'Immense"},
  {ar:"الحكيم",tr:"Al-Hakîm",fr:"Le Sage"},{ar:"الودود",tr:"Al-Wadûd",fr:"L'Affectueux"},
  {ar:"المجيد",tr:"Al-Majid",fr:"Le Très Glorieux"},{ar:"الباعث",tr:"Al-Bâith",fr:"Le Ressusciteur"},
  {ar:"الشهيد",tr:"Ash-Shahid",fr:"Le Témoin"},{ar:"الحق",tr:"Al-Haqq",fr:"La Vérité Absolue"},
  {ar:"الوكيل",tr:"Al-Wakil",fr:"Le Garant"},{ar:"القوي",tr:"Al-Qawi",fr:"Le Très Fort"},
  {ar:"المتين",tr:"Al-Matin",fr:"Le Solide"},{ar:"الولي",tr:"Al-Wali",fr:"Le Protecteur Allié"},
  {ar:"الحميد",tr:"Al-Hamid",fr:"Le Digne de Louange"},{ar:"المحصي",tr:"Al-Muhsi",fr:"Celui qui dénombre"},
  {ar:"المبدئ",tr:"Al-Mubdi",fr:"L'Initiateur"},{ar:"المعيد",tr:"Al-Muid",fr:"Le Restaurateur"},
  {ar:"المحيي",tr:"Al-Muhyi",fr:"Celui qui vivifie"},{ar:"المميت",tr:"Al-Mumit",fr:"Celui qui fait mourir"},
  {ar:"الحي",tr:"Al-Hayy",fr:"Le Vivant"},{ar:"القيوم",tr:"Al-Qayyûm",fr:"Le Subsistant"},
  {ar:"الواجد",tr:"Al-Wâjid",fr:"Celui qui trouve"},{ar:"الماجد",tr:"Al-Mâjid",fr:"Le Noble Glorieux"},
  {ar:"الواحد",tr:"Al-Wâhid",fr:"L'Unique"},{ar:"الأحد",tr:"Al-Ahad",fr:"L'Un Absolu"},
  {ar:"الصمد",tr:"As-Samad",fr:"L'Impénétrable"},{ar:"القادر",tr:"Al-Qâdir",fr:"Le Capable"},
  {ar:"المقتدر",tr:"Al-Muqtadir",fr:"Le Tout Puissant"},{ar:"المقدم",tr:"Al-Muqaddim",fr:"Celui qui avance"},
  {ar:"المؤخر",tr:"Al-Muakhkhir",fr:"Celui qui diffère"},{ar:"الأول",tr:"Al-Awwal",fr:"Le Premier"},
  {ar:"الآخر",tr:"Al-Âkhir",fr:"Le Dernier"},{ar:"الظاهر",tr:"Az-Zâhir",fr:"Le Manifeste"},
  {ar:"الباطن",tr:"Al-Bâtin",fr:"Le Caché"},{ar:"الوالي",tr:"Al-Wâli",fr:"Le Gouverneur"},
  {ar:"المتعالي",tr:"Al-Mutaâli",fr:"Le Transcendant"},{ar:"البر",tr:"Al-Barr",fr:"Le Bienfaisant"},
  {ar:"التواب",tr:"At-Tawwâb",fr:"L'Accepteur du Repentir"},{ar:"المنتقم",tr:"Al-Muntaqim",fr:"Le Vengeur"},
  {ar:"العفو",tr:"Al-Afuw",fr:"Celui qui efface"},{ar:"الرؤوف",tr:"Ar-Raûf",fr:"Le Très Compatissant"},
  {ar:"مالك الملك",tr:"Mâlik Al-Mulk",fr:"Maître du Royaume"},{ar:"ذو الجلال",tr:"Dhul-Jalâl",fr:"Maître de la Majesté"},
  {ar:"المقسط",tr:"Al-Muqsit",fr:"L'Équitable"},{ar:"الجامع",tr:"Al-Jâmi",fr:"Le Rassembleur"},
  {ar:"الغني",tr:"Al-Ghani",fr:"Le Riche Absolu"},{ar:"المغني",tr:"Al-Mughni",fr:"Celui qui enrichit"},
  {ar:"المانع",tr:"Al-Mâni",fr:"Celui qui protège"},{ar:"الضار",tr:"Ad-Dârr",fr:"Celui qui peut nuire"},
  {ar:"النافع",tr:"An-Nâfi",fr:"Celui qui profite"},{ar:"النور",tr:"An-Nûr",fr:"La Lumière"},
  {ar:"الهادي",tr:"Al-Hâdi",fr:"Le Guide"},{ar:"البديع",tr:"Al-Badi",fr:"L'Innovateur"},
  {ar:"الباقي",tr:"Al-Bâqi",fr:"Le Permanent"},{ar:"الوارث",tr:"Al-Wârith",fr:"L'Héritier"},
  {ar:"الرشيد",tr:"Ar-Rashid",fr:"Le Guide Droit"},{ar:"الصبور",tr:"As-Sabûr",fr:"Le Très Patient"},
];

const CORR={
  "ا":{el:"🔥 Feu",pl:"☀️ Soleil",org:"❤️ Cœur",al:"🍯 Miel",sw:"1 · Al-Fâtiha"},
  "ب":{el:"💧 Eau",pl:"🌙 Lune",org:"🧠 Cerveau",al:"🍇 Raisins",sw:"2 · Al-Baqara"},
  "ج":{el:"🌍 Terre",pl:"♂ Mars",org:"🫀 Foie",al:"🌴 Dattes",sw:"3 · Âl-Imrân"},
  "د":{el:"🌬 Air",pl:"♀ Vénus",org:"🫁 Poumons",al:"🍃 Figues",sw:"4 · An-Nisâ"},
  "ه":{el:"🔥 Feu",pl:"♃ Jupiter",org:"❤️ Cœur",al:"🌿 Cannelle",sw:"5 · Al-Mâida"},
  "و":{el:"💧 Eau",pl:"☿ Mercure",org:"🫘 Reins",al:"🍎 Grenade",sw:"6 · Al-Anam"},
  "ز":{el:"🌍 Terre",pl:"♄ Saturne",org:"💜 Rate",al:"🫒 Olives",sw:"7 · Al-Araf"},
  "ح":{el:"🌬 Air",pl:"☀️ Soleil",org:"🫁 Poumons",al:"🌾 Orge",sw:"8 · Al-Anfâl"},
  "ط":{el:"🔥 Feu",pl:"🌙 Lune",org:"💛 Vésicule",al:"🍯 Miel brun",sw:"9 · At-Tawba"},
  "ي":{el:"💧 Eau",pl:"♂ Mars",org:"🧠 Cerveau",al:"🍋 Citron",sw:"10 · Yûnus"},
  "ك":{el:"🌍 Terre",pl:"♀ Vénus",org:"🦴 Os",al:"🥜 Amandes",sw:"11 · Hûd"},
  "ل":{el:"🌬 Air",pl:"♃ Jupiter",org:"🩸 Sang",al:"🥛 Lait",sw:"12 · Yûsuf"},
  "م":{el:"💧 Eau",pl:"☿ Mercure",org:"🌊 Utérus",al:"💧 Eau pure",sw:"13 · Ar-Rad"},
  "ن":{el:"🔥 Feu",pl:"♄ Saturne",org:"👁 Yeux",al:"🐟 Poisson",sw:"14 · Ibrâhîm"},
  "س":{el:"🌍 Terre",pl:"☀️ Soleil",org:"🌀 Intestins",al:"🌻 Sésame",sw:"15 · Al-Hijr"},
  "ع":{el:"🌬 Air",pl:"🌙 Lune",org:"🗣 Gorge",al:"🍇 Raisins noirs",sw:"16 · An-Nahl"},
  "ف":{el:"💧 Eau",pl:"♂ Mars",org:"🫀 Foie",al:"🍉 Pastèque",sw:"17 · Al-Isra"},
  "ص":{el:"🌍 Terre",pl:"♀ Vénus",org:"🌀 Côlon",al:"🍎 Grenade",sw:"18 · Al-Kahf"},
  "ق":{el:"🔥 Feu",pl:"♃ Jupiter",org:"❤️ Cœur",al:"🟡 Curcuma",sw:"19 · Maryam"},
  "ر":{el:"🌬 Air",pl:"☿ Mercure",org:"🫁 Poumons",al:"🌿 Menthe",sw:"20 · Tâ-Hâ"},
  "ش":{el:"💧 Eau",pl:"♄ Saturne",org:"🟤 Peau",al:"🍯 Miel acacia",sw:"21 · Al-Anbiyâ"},
  "ت":{el:"🌍 Terre",pl:"☀️ Soleil",org:"🦴 Os",al:"🌵 Figues sèches",sw:"22 · Al-Hajj"},
  "ث":{el:"🌬 Air",pl:"🌙 Lune",org:"🗣 Gorge",al:"🌿 Thym",sw:"23 · Al-Muminûn"},
  "خ":{el:"🔥 Feu",pl:"♂ Mars",org:"💛 Vésicule",al:"⚫ Kohl",sw:"24 · An-Nûr"},
  "ذ":{el:"💧 Eau",pl:"♀ Vénus",org:"🧠 Cerveau",al:"🟡 Safran",sw:"25 · Al-Furqân"},
  "ض":{el:"🌍 Terre",pl:"♃ Jupiter",org:"💜 Rate",al:"🟡 Curcuma",sw:"26 · Ash-Shuarâ"},
  "ظ":{el:"🌬 Air",pl:"☿ Mercure",org:"💪 Muscles",al:"🫚 Gingembre",sw:"27 · An-Naml"},
  "غ":{el:"🔥 Feu",pl:"♄ Saturne",org:"👁 Yeux",al:"🌿 Cardamome",sw:"28 · Al-Qasas"},
};

const PCOL={fajr:"rgba(160,200,255,.9)",dhuhr:"rgba(255,235,150,.9)",asr:"rgba(255,190,80,.9)",maghrib:"rgba(255,120,70,.9)",isha:"rgba(180,130,230,.9)"};
const PLBL={fajr:"Fajr",dhuhr:"Dhuhr",asr:"Asr",maghrib:"Maghrib",isha:"Isha"};

function calcPrayers(lat,lng,date=new Date()) {
  const D2R=Math.PI/180,R2D=180/Math.PI;
  const start=new Date(date.getFullYear(),0,0);
  const doy=Math.floor((date-start)/86400000);
  const B=D2R*(360/365*(doy-81));
  const dec=Math.asin(Math.sin(23.45*D2R)*Math.sin(B));
  const EqT=9.87*Math.sin(2*B)-7.53*Math.cos(B)-1.5*Math.sin(B);
  const tzOff=-date.getTimezoneOffset()/60;
  const noon=12-(lng/15-tzOff)+EqT/60;
  const sL=Math.sin(lat*D2R),cL=Math.cos(lat*D2R),sD=Math.sin(dec),cD=Math.cos(dec);
  function ha(alt) {
    const c=(Math.sin(alt*D2R)-sL*sD)/(cL*cD);
    return Math.abs(c)>1?null:R2D*Math.acos(c)/15;
  }
  const aA=R2D*Math.atan(1/(1+Math.tan(Math.abs(lat*D2R-dec))));
  const fH=ha(-18),sH=ha(-0.833),iH=ha(-17),aH=ha(aA);
  const fmt=h=>{
    if(h===null) return "--:--";
    const t=((h%24)+24)%24,m=Math.round((t%1)*60),hr=Math.floor(t);
    return String(hr).padStart(2,"0")+":"+String(m).padStart(2,"0");
  };
  return {
    fajr:fmt(fH!==null?noon-fH:null),
    dhuhr:fmt(noon),
    asr:fmt(aH!==null?noon+aH:null),
    maghrib:fmt(sH!==null?noon+sH:null),
    isha:fmt(iH!==null?noon+iH:null)
  };
}

const STARS=Array.from({length:200},(_,i)=>({x:(i*137.508)%100,y:(i*97.301)%100,r:.2+(i%6)*.25,dur:2.5+(i%9),del:-(i%8)}));

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Amiri&display=swap');
@keyframes pulsOrb{0%,100%{transform:scale(1);opacity:.4}50%{transform:scale(1.6);opacity:.72}}
@keyframes kunPulse{0%{transform:scale(1);opacity:.4}20%{transform:scale(3.5);opacity:.95}50%{transform:scale(2);opacity:.7}80%{transform:scale(2.5);opacity:.85}100%{transform:scale(1);opacity:.4}}
@keyframes glimmer{0%,100%{opacity:.12}50%{opacity:.75}}
@keyframes circuitDraw{from{stroke-dashoffset:1000}to{stroke-dashoffset:0}}
@keyframes fadeUp{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@keyframes litGlow{0%,100%{filter:url(#glow)}50%{filter:url(#sg)}}
.orb-idle{transform-box:fill-box;transform-origin:center;animation:pulsOrb 3.4s ease-in-out infinite}
.orb-kun{transform-box:fill-box;transform-origin:center;animation:kunPulse 1s ease-in-out 3}
.star{animation:glimmer var(--d) ease-in-out var(--del) infinite}
.fadein{animation:fadeUp .35s ease both}
.lit{animation:litGlow 0.8s ease-in-out infinite}
input::placeholder{color:rgba(180,140,50,.35)}
input:focus{outline:none;border-bottom-color:rgba(200,160,50,.7)!important}
button:hover:not(:disabled){opacity:.75}
::-webkit-scrollbar{width:3px}
::-webkit-scrollbar-thumb{background:rgba(200,160,50,.25);border-radius:2px}
.tb{background:none;border:none;cursor:pointer;padding:8px 10px;font-family:Cinzel,serif;font-size:7.5px;letter-spacing:2px;text-transform:uppercase;color:rgba(200,160,50,.38);border-bottom:1.5px solid transparent;transition:all .2s}
.tb.on{color:#C9A84C;border-bottom-color:#C9A84C}
.tb:hover{color:rgba(200,160,50,.7)}
`;

export default function NEXUSCrystal() {
  const [tab,setTab]         = useState("cristal");
  const [rot,setRot]         = useState(0);
  const [hov,setHov]         = useState(null);
  const [lit,setLit]         = useState(new Set());
  const [kunOn,setKunOn]     = useState(false);
  const [input,setInput]     = useState("");
  const [analysis,setAnalysis] = useState(null);
  const [aiText,setAiText]   = useState("");
  const [loading,setLoading] = useState(false);
  const [rootIn,setRootIn]   = useState("");
  const [prayers,setPrayers] = useState(null);
  const [loc,setLoc]         = useState({lat:48.5734,lng:7.7521});
  const [selCorr,setSelCorr] = useState(null);
  const [showNames,setShowNames] = useState(false);
  const [selName,setSelName] = useState(null);
  const [nameQ,setNameQ]     = useState("");

  const [nafarCount,setNafarCount] = useState(0);
  const [nafarPulse,setNafarPulse] = useState(false);
  const [nafarWord,setNafarWord]   = useState("");
  const socketRef = useRef(null);

  const svgRef = useRef(null);
  const drag   = useRef({on:false,a0:0,r0:0});

  useEffect(() => {
    const socket = io(window.location.origin, { transports:["websocket","polling"] });
    socketRef.current = socket;
    socket.on("collective_pulse", ({ word, count }) => {
      setNafarCount(count); setNafarWord(word||""); setNafarPulse(true);
      setTimeout(() => setNafarPulse(false), 3000);
    });
    socket.on("room_count", ({ count }) => setNafarCount(count));
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kunParam = params.get("kun");
    if (kunParam) { setInput(decodeURIComponent(kunParam)); setTab("cristal"); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if(navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => setLoc({lat:p.coords.latitude,lng:p.coords.longitude}),
        () => {}
      );
    }
  },[]);

  useEffect(() => {
    const upd = () => setPrayers(calcPrayers(loc.lat,loc.lng));
    upd();
    const id = setInterval(upd,60000);
    return () => clearInterval(id);
  },[loc]);

  function getAngle(e) {
    const svg=svgRef.current;
    if(!svg) return 0;
    const rect=svg.getBoundingClientRect();
    const sx=S/rect.width, sy=S/rect.height;
    const src=e.touches?e.touches[0]:e;
    return Math.atan2((src.clientY-rect.top)*sy-CY,(src.clientX-rect.left)*sx-CX)*180/Math.PI;
  }

  const onDown = e => { drag.current={on:true,a0:getAngle(e),r0:rot}; };
  const onMove = e => { if(!drag.current.on) return; setRot(drag.current.r0+getAngle(e)-drag.current.a0); setHov(null); };
  const onUp   = () => { drag.current.on=false; };

  const illuminate = useCallback((chars, ms=2500) => {
    const s = new Set([...chars].filter(c=>ABJAD[c]));
    setLit(s); setKunOn(true);
    setTimeout(() => setKunOn(false), ms);
  },[]);

  const handleKun = useCallback(async () => {
    const q=input.trim();
    if(!q) return;
    const letters=[...q].filter(c=>ABJAD[c]).map(c=>({char:c,value:ABJAD[c]}));
    const total=letters.reduce((s,l)=>s+l.value,0);
    const reduced=reduce(total);
    const result={letters,total,reduced};
    setAnalysis(result); setAiText(""); setSelName(null);
    illuminate(q, 3000);
    if(socketRef.current) socketRef.current.emit("activate", { word:q, reduced:reduce(letters.reduce((s,l)=>s+l.value,0)), archetype:"" });
    const url=new URL(window.location.href); url.searchParams.set("kun",encodeURIComponent(q)); window.history.replaceState(null,"",url.toString());
    if(!letters.length) return;
    setLoading(true);
    try {
      const matchNames=N99.map(n=>({...n,red:reduce(abj(n.ar))}))
        .filter(n=>n.red===reduced).slice(0,5).map(n=>n.tr).join(", ");
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          messages:[{role:"user",content:
            "Tu es NEXUS, oracle de phonosémantique arabe.\n"+
            "Texte : «"+q+"» · Abjad : "+total+" → réduit : "+reduced+" = "+(ARCH[reduced]||"?")+"\n"+
            "Noms divins résonnants (même archétype "+reduced+") : "+(matchNames||"—")+"\n\n"+
            "En 3 points concis :\n"+
            "1. Racine triconsonantique et champ sémantique profond.\n"+
            "2. Résonance vibratoire du nombre "+reduced+" + lien aux Noms divins.\n"+
            "3. Polarité : «Connaissant» ou «Pirate» — justifie en 1 phrase.\n"+
            "Style : oraculaire, précis. Français. Maximum 6 lignes."
          }]
        })
      });
      const data = await res.json();
      const txt = (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("") || "—";
      setAiText(txt);
    } catch(err) {
      setAiText("Erreur connexion.");
    }
    setLoading(false);
  },[input, illuminate]);

  const selectName = useCallback(name => {
    setSelName(name); setAnalysis(null); setAiText("");
    illuminate(name.ar, 2500);
    setTab("cristal"); setShowNames(false);
  },[illuminate]);

  const rootChars = useMemo(() => [...rootIn].filter(c=>ABJAD[c]).slice(0,3), [rootIn]);
  const rootPerms = useMemo(() => {
    if(rootChars.length!==3) return [];
    return perms(rootChars).map(p=>({word:p.join(""),value:p.reduce((s,l)=>s+(ABJAD[l]||0),0)}));
  },[rootChars]);

  const activePrayer = useMemo(() => {
    if(!prayers) return null;
    const now=new Date(), curr=now.getHours()*60+now.getMinutes();
    for(const k of ["fajr","dhuhr","asr","maghrib","isha"]) {
      const parts=prayers[k].split(":");
      const h=parseInt(parts[0],10), m=parseInt(parts[1],10);
      if(Math.abs(curr-(h*60+m))<=20) return k;
    }
    return null;
  },[prayers]);

  const filteredNames = useMemo(() =>
    N99.filter(n => !nameQ || n.tr.toLowerCase().includes(nameQ.toLowerCase()) || n.ar.includes(nameQ) || n.fr.toLowerCase().includes(nameQ.toLowerCase()))
  ,[nameQ]);

  const espPts  = [0,120,240].map(d=>pt(d));
  const matPts  = [60,180,300].map(d=>pt(d));
  const [axAx,axAy] = pt(0);
  const [axBx,axBy] = pt(180);
  const circPts = ALL.filter(l=>lit.has(l.l)).map(l=>pt(l.deg,LR));
  const hovLet  = hov!==null ? ALL.find(l=>l.deg===hov) : null;

  const gold="#C9A84C", silver="#a8bcdc";

  function Seal({inv=false, interactive=false}) {
    const gc=inv?"#8B1A1A":gold;
    const sc=inv?"#5A0070":silver;
    const orbId=inv?"invOrb":"normOrb";
    return (
      <svg
        ref={interactive?svgRef:null}
        width={S} height={S}
        viewBox={"0 0 "+S+" "+S}
        style={{maxWidth:"90vw",maxHeight:inv?"42vh":"44vh",flexShrink:0,cursor:interactive?"grab":"default",touchAction:"none"}}
        onMouseDown={interactive?onDown:undefined}
        onMouseMove={interactive?onMove:undefined}
        onMouseUp={interactive?onUp:undefined}
        onMouseLeave={interactive?onUp:undefined}
        onTouchStart={interactive?onDown:undefined}
        onTouchMove={interactive?onMove:undefined}
        onTouchEnd={interactive?onUp:undefined}
      >
        <defs>
          <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="sg" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="7" result="b1"/>
            <feGaussianBlur stdDeviation="3" in="SourceGraphic" result="b2"/>
            <feMerge><feMergeNode in="b1"/><feMergeNode in="b1"/><feMergeNode in="b2"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <radialGradient id="normOrb">
            <stop offset="0%" stopColor="white" stopOpacity="1"/>
            <stop offset="38%" stopColor="#80b4ff" stopOpacity=".72"/>
            <stop offset="100%" stopColor="#1030a0" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="invOrb">
            <stop offset="0%" stopColor="white" stopOpacity="1"/>
            <stop offset="38%" stopColor="#ff7060" stopOpacity=".8"/>
            <stop offset="100%" stopColor="#600010" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="aura">
            <stop offset="0%" stopColor="rgba(190,150,40,.1)"/>
            <stop offset="100%" stopColor="transparent"/>
          </radialGradient>
        </defs>

        <circle cx={CX} cy={CY} r={R+50} fill="url(#aura)"/>

        <g transform={inv ? "translate("+CX*2+",0) scale(-1,1)" : undefined}>
          <g transform={interactive ? "rotate("+rot+","+CX+","+CY+")" : undefined}>

            <circle cx={CX} cy={CY} r={R+15} fill="none" stroke="rgba(200,160,50,.1)" strokeWidth=".7"/>
            <circle cx={CX} cy={CY} r={R} fill="none" stroke={gc} strokeWidth="1.6" opacity=".9" filter="url(#glow)"/>
            <circle cx={CX} cy={CY} r={R*.56} fill="none" stroke="rgba(200,160,50,.09)" strokeWidth=".6"/>

            <line x1={axAx} y1={axAy} x2={axBx} y2={axBy}
              stroke={inv?"rgba(139,26,26,.2)":"rgba(200,160,50,.18)"}
              strokeWidth=".7" strokeDasharray="4,7"/>

            <polygon points={pStr(espPts)}
              fill={inv?"rgba(139,26,26,.06)":"rgba(200,160,50,.04)"}
              stroke={gc} strokeWidth="1.55" opacity=".92" filter="url(#glow)"/>
            <polygon points={pStr(matPts)}
              fill={inv?"rgba(90,0,112,.05)":"rgba(170,190,230,.03)"}
              stroke={sc} strokeWidth="1.3" opacity=".85" filter="url(#glow)"/>

            {!inv && circPts.length>=2 && (
              <polygon points={pStr(circPts)} fill="none"
                stroke="rgba(255,255,100,.55)" strokeWidth="1"
                strokeDasharray="1000" opacity=".75"
                style={{animation:"circuitDraw 2s ease forwards"}}/>
            )}

            {ALL.map(letter => {
              const [lx,ly]  = pt(letter.deg,LR);
              const [t1x,t1y]= pt(letter.deg,R+3);
              const [t2x,t2y]= pt(letter.deg,R+11);
              const isE  = letter.tri==="e";
              const isM  = letter.tri==="m";
              const isV  = isE||isM;
              const isH  = hov===letter.deg;
              const isLit= !inv && lit.has(letter.l);
              const base = inv ? (isE?"#8B1A1A":"#5A0070") : (isE?gc:isM?silver:"#9E7828");
              const col  = isLit?"#FFFF80" : isH?(isE?"#FFD700":isM?"#d0e4ff":"#D4A040") : base;
              const fs   = isH?(isV?18:15):(isV?15:11);
              const iTx  = inv ? "matrix(-1,0,0,1,"+(2*lx)+",0)" : undefined;
              return (
                <g key={letter.deg}
                  onMouseEnter={() => { if(!drag.current.on && !inv) setHov(letter.deg); }}
                  onMouseLeave={() => setHov(null)}
                  style={{cursor:"default"}}>
                  <line x1={t1x} y1={t1y} x2={t2x} y2={t2y}
                    stroke={col} strokeWidth={isV?1.5:.9}
                    opacity={isH?.9:isV?.55:.3}/>
                  <circle cx={lx} cy={ly} r={isV?14:10}
                    fill={isLit?"rgba(255,255,100,.1)":isE?"rgba(200,160,50,.09)":isM?"rgba(168,188,220,.07)":"rgba(200,140,40,.05)"}
                    filter={(isV||isLit||isH)?"url(#glow)":undefined}/>
                  {/* lettre arabe */}
                  <text x={lx} y={ly-(isV?2:1)} textAnchor="middle" dominantBaseline="middle"
                    transform={iTx} fontSize={fs} fill={col}
                    opacity={isH?1:isLit?1:isV?.95:.75}
                    filter={(isH||isV||isLit)?"url(#glow)":undefined}
                    className={isLit?"lit":undefined}
                    style={{fontFamily:"Amiri,serif",transition:"font-size .12s"}}>
                    {letter.l}
                  </text>
                  {/* valeur abjad — toujours visible pour TOUTES les lettres */}
                  <text x={lx} y={ly+fs/2+8} textAnchor="middle"
                    transform={iTx} fontSize={isV?"7.5":"6"} fill={col}
                    opacity={isH?1:isV?.8:.6}
                    style={{fontFamily:"Cinzel,serif"}}>
                    {letter.v}
                  </text>
                  {/* translittération — toujours visible pour TOUTES les lettres */}
                  <text x={lx} y={ly-fs/2-7} textAnchor="middle"
                    transform={iTx} fontSize={isV?"7":"5.5"} fill={col}
                    opacity={isH?1:isV?.7:.5}
                    style={{fontFamily:"Cinzel,serif",letterSpacing:".3px"}}>
                    {letter.n}
                  </text>
                </g>
              );
            })}

            {VERTEX.map(v => {
              const [x,y]=pt(v.deg,R);
              return <circle key={"vd"+v.deg} cx={x} cy={y}
                r={v.tri==="e"?4.5:3.8}
                fill={v.tri==="e"?gc:sc} opacity=".88" filter="url(#glow)"/>;
            })}

            <circle cx={CX} cy={CY} r={20} fill={"url(#"+orbId+")"}
              opacity=".45" className={kunOn&&!inv?"orb-kun":"orb-idle"}/>
            <circle cx={CX} cy={CY} r={10} fill={"url(#"+orbId+")"}
              filter="url(#sg)" opacity=".88"/>
            <circle cx={CX} cy={CY} r={4.5} fill="white" filter="url(#glow)"/>
            <text x={CX} y={CY+25} textAnchor="middle"
              transform={inv?"matrix(-1,0,0,1,"+(2*CX)+",0)":undefined}
              fontSize="7"
              fill={inv?"rgba(180,50,50,.6)":"rgba(200,160,50,.4)"}
              style={{fontFamily:"Cinzel,serif"}}>
              {inv?"أنا · 52":"ن · 50"}
            </text>
          </g>
        </g>
      </svg>
    );
  }

  const G=gold, W="rgba(200,160,50,.5)", D="rgba(200,160,50,.25)", DIM="rgba(200,160,50,.12)";

  return (
    <div style={{minHeight:"100vh",background:"#020210",display:"flex",flexDirection:"column",alignItems:"center",padding:"0 0 20px",boxSizing:"border-box",position:"relative",overflow:"hidden",fontFamily:"Cinzel,Palatino,serif"}}>
      <style>{CSS}</style>

      {STARS.map((s,i) => (
        <div key={i} className="star" style={{position:"absolute",left:s.x+"%",top:s.y+"%",width:s.r*2,height:s.r*2,borderRadius:"50%",background:"rgba(210,215,255,.85)",pointerEvents:"none","--d":s.dur+"s","--del":s.del+"s"}}/>
      ))}

      {/* ── HEADER ─────────────────────────────────────────── */}
      <div style={{width:"100%",maxWidth:420,padding:"14px 14px 0",boxSizing:"border-box",position:"relative",zIndex:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{color:"rgba(200,165,60,.55)",fontSize:8,letterSpacing:6}}>N E X U S</div>
            <div style={{color:"#C9A84C",fontSize:13,letterSpacing:4,marginTop:3,fontWeight:600,filter:"drop-shadow(0 0 8px rgba(200,160,50,.4))"}}>Cristal de HU · هُوَ</div>
            <div style={{color:"rgba(200,160,50,.38)",fontSize:7.5,marginTop:3,fontFamily:"Amiri,serif",direction:"rtl",letterSpacing:1}}>
              ١+٥+٦=١٢→٣ · ٣٠+٤٠+٥٠=١٢٠→٣ · ٣+٣=٦
            </div>
          </div>
          <button onClick={() => setShowNames(v=>!v)}
            style={{background:"none",border:"1px solid rgba(200,160,50,.35)",color:"#C9A84C",fontSize:7,letterSpacing:2,padding:"5px 9px",cursor:"pointer",fontFamily:"Cinzel,serif",borderRadius:1,marginTop:2}}>
            99 NOMS ▾
          </button>
        </div>

        {prayers && (
          <div style={{display:"flex",gap:5,marginTop:8,flexWrap:"wrap"}}>
            {["fajr","dhuhr","asr","maghrib","isha"].map(k => {
              const isA=activePrayer===k;
              return (
                <div key={k} style={{textAlign:"center",padding:"2px 7px",borderRadius:1,background:isA?"rgba(200,160,50,.12)":"transparent",border:"1px solid "+(isA?D:DIM)}}>
                  <div style={{color:isA?PCOL[k]:"rgba(200,160,50,.3)",fontSize:5.5,letterSpacing:1}}>{PLBL[k]}</div>
                  <div style={{color:isA?G:W,fontSize:9,fontFamily:"Cinzel,serif"}}>{prayers[k]}</div>
                </div>
              );
            })}
          </div>
        )}
        {(nafarCount>1||nafarPulse) && (
          <div style={{marginTop:8,padding:"5px 10px",border:"1px solid rgba(200,160,50,.25)",borderRadius:1,background:"rgba(200,160,50,.06)",display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:nafarPulse?"#FFFF80":"rgba(200,160,50,.6)",boxShadow:nafarPulse?"0 0 12px #FFFF80":undefined}}/>
            <span style={{color:"#C9A84C",fontSize:8,letterSpacing:2}}>NAFAR · {nafarCount} âmes vibrent</span>
            {nafarWord && <span style={{color:"rgba(200,160,50,.6)",fontSize:10,fontFamily:"Amiri,serif"}}>{nafarWord}</span>}
          </div>
        )}
      </div> ───────────────────────────────────────────── */}
      <div style={{width:"100%",maxWidth:420,display:"flex",borderBottom:"1px solid rgba(200,160,50,.1)",position:"relative",zIndex:10,marginTop:8}}>
        {[["cristal","⬡ Cristal"],["racines","✦ Racines"],["inversion","⊘ Zérkâle"],["awraq","◈ Awrâq"]].map(([id,lbl]) => (
          <button key={id} className={"tb"+(tab===id?" on":"")} onClick={() => { setTab(id); setShowNames(false); }}>{lbl}</button>
        ))}
      </div>

      {/* ── CRISTAL ────────────────────────────────────────── */}
      {tab==="cristal" && (
        <div style={{width:"100%",maxWidth:420,display:"flex",flexDirection:"column",alignItems:"center",position:"relative",zIndex:2}}>
          <Seal inv={false} interactive={true}/>

          <div style={{height:40,display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginTop:2}}>
            {hovLet ? (
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:26,color:hovLet.tri==="e"?G:hovLet.tri==="m"?silver:G,fontFamily:"Amiri,serif",filter:"drop-shadow(0 0 9px rgba(200,160,50,.6))"}}>{hovLet.l}</span>
                <div>
                  <div style={{color:G,fontSize:10,letterSpacing:2}}>{hovLet.n}</div>
                  <div style={{color:W,fontSize:8,marginTop:1}}>Abjad {hovLet.v}{hovLet.tri?" · "+(hovLet.tri==="e"?"Esprit ▲":"Matière ▽"):""}</div>
                </div>
              </div>
            ) : selName ? (
              <div style={{textAlign:"center"}}>
                <span style={{fontSize:18,color:G,fontFamily:"Amiri,serif"}}>{selName.ar}</span>
                <span style={{color:W,fontSize:8,marginLeft:8}}>{selName.tr} · {abj(selName.ar)}</span>
              </div>
            ) : (
              <div style={{color:"rgba(180,140,50,.2)",fontSize:7.5,letterSpacing:4}}>GLISSEZ · SURVOLEZ · KUN</div>
            )}
          </div>

          <div style={{width:"100%",maxWidth:370,height:1,background:"linear-gradient(90deg,transparent,rgba(200,160,50,.25),transparent)",margin:"8px 0 12px"}}/>

          <div style={{width:"100%",maxWidth:370,padding:"0 14px",boxSizing:"border-box"}}>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&handleKun()}
                placeholder="أدخل كلمة أو نية..."
                style={{flex:1,background:"rgba(4,3,14,.85)",border:"none",borderBottom:"1px solid "+D,color:G,fontSize:18,padding:"8px 4px",fontFamily:"Amiri,serif",direction:"rtl",textAlign:"right",borderRadius:0}}/>
              <button onClick={handleKun} disabled={loading}
                style={{background:"none",border:"1px solid "+D,color:loading?W:G,fontSize:9,letterSpacing:2.5,padding:"8px 12px",cursor:loading?"default":"pointer",fontFamily:"Cinzel,serif",textTransform:"uppercase",borderRadius:1}}>
                {loading?"·":"KUN"}
              </button>
            </div>

            {analysis && (
              <div className="fadein" style={{marginTop:10,background:"rgba(5,4,16,.93)",border:"1px solid rgba(200,160,50,.13)",borderRadius:2,padding:"12px 13px 14px",maxHeight:300,overflowY:"auto"}}>
                {analysis.letters.length===0 ? (
                  <div style={{color:W,fontSize:9,textAlign:"center"}}>Aucune lettre arabe détectée</div>
                ) : (
                  <div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:10,direction:"rtl"}}>
                      {analysis.letters.map((l,i) => (
                        <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",border:"1px solid rgba(200,160,50,.22)",borderRadius:2,padding:"3px 7px",background:"rgba(200,160,50,.04)"}}>
                          <span style={{fontSize:18,color:G,fontFamily:"Amiri,serif",lineHeight:1.2}}>{l.char}</span>
                          <span style={{fontSize:7,color:W,fontFamily:"Cinzel,serif"}}>{l.value}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"1px solid rgba(200,160,50,.12)",paddingTop:8,marginBottom:6}}>
                      <span style={{color:W,fontSize:9,fontFamily:"Cinzel,serif"}}>Σ {analysis.total}</span>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{color:G,fontSize:12,fontFamily:"Cinzel,serif"}}>→ {analysis.reduced}</span>
                        <span style={{color:G,fontSize:20,fontFamily:"Amiri,serif",filter:"drop-shadow(0 0 6px rgba(200,160,50,.5))"}}>{ROOT_L[analysis.reduced]||""}</span>
                        <div>
                          <div style={{color:"rgba(200,160,50,.7)",fontSize:8,fontFamily:"Cinzel,serif"}}>{ARCH[analysis.reduced]||""}</div>
                        </div>
                      </div>
                    </div>
                    {(() => {
                      const matches=N99.map(n=>({...n,red:reduce(abj(n.ar))})).filter(n=>n.red===analysis.reduced).slice(0,4);
                      if(!matches.length) return null;
                      return (
                        <div style={{borderTop:"1px solid rgba(200,160,50,.1)",paddingTop:7,marginBottom:6}}>
                          <div style={{color:"rgba(200,160,50,.38)",fontSize:6.5,letterSpacing:2,marginBottom:4}}>NOMS RÉSONNANTS</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                            {matches.map((n,i) => (
                              <div key={i} onClick={() => selectName(n)}
                                style={{border:"1px solid rgba(200,160,50,.2)",borderRadius:2,padding:"3px 8px",cursor:"pointer",background:"rgba(200,160,50,.04)"}}>
                                <span style={{color:G,fontSize:14,fontFamily:"Amiri,serif"}}>{n.ar}</span>
                                <span style={{color:W,fontSize:7,marginLeft:4}}>{n.tr}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    {loading && <div style={{textAlign:"center",color:W,fontSize:10,padding:"8px 0",letterSpacing:5}}>· · ·</div>}
                    {aiText && (
                      <div style={{borderTop:"1px solid rgba(200,160,50,.1)",paddingTop:10,marginTop:6,color:"rgba(220,194,136,.88)",fontSize:10.5,lineHeight:1.8,fontFamily:"Georgia,serif",whiteSpace:"pre-wrap"}}>{aiText}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── RACINES ────────────────────────────────────────── */}
      {tab==="racines" && (
        <div style={{width:"100%",maxWidth:420,padding:"16px 14px",boxSizing:"border-box",position:"relative",zIndex:2}}>
          <div style={{color:W,fontSize:8,letterSpacing:3,marginBottom:4}}>LOI DE PERMUTATION VIBRATOIRE</div>
          <div style={{color:D,fontSize:8,lineHeight:1.6,marginBottom:14}}>
            Toute racine triconsonantique et ses permutations partagent la même valeur Abjad. La langue arabe est un cristal mathématique.
          </div>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            <input value={rootIn} onChange={e=>setRootIn(e.target.value)}
              placeholder="رحم · أدخل 3 حروف"
              style={{flex:1,background:"rgba(4,3,14,.85)",border:"none",borderBottom:"1px solid "+D,color:G,fontSize:24,padding:"8px 4px",fontFamily:"Amiri,serif",direction:"rtl",textAlign:"right",borderRadius:0}}/>
          </div>
          {rootChars.length>0 && rootChars.length<3 && (
            <div style={{color:D,fontSize:9,textAlign:"center",marginBottom:12}}>{rootChars.length}/3 lettres</div>
          )}
          {rootChars.length===3 && (
            <div className="fadein">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,padding:"8px 10px",background:"rgba(200,160,50,.06)",border:"1px solid rgba(200,160,50,.15)",borderRadius:2}}>
                <div>
                  <div style={{color:W,fontSize:7.5,letterSpacing:2}}>VALEUR INVARIANTE</div>
                  <div style={{color:G,fontSize:20,fontFamily:"Cinzel,serif",marginTop:2}}>{rootChars.reduce((s,l)=>s+(ABJAD[l]||0),0)}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{color:W,fontSize:7.5,letterSpacing:2}}>ARCHÉTYPE</div>
                  <div style={{color:"rgba(200,160,50,.7)",fontSize:9,marginTop:2}}>{ARCH[reduce(rootChars.reduce((s,l)=>s+(ABJAD[l]||0),0))]||""}</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7}}>
                {rootPerms.map((p,i) => (
                  <div key={i} style={{textAlign:"center",padding:"10px 6px",border:"1px solid rgba(200,160,50,.2)",borderRadius:2,background:"rgba(200,160,50,.04)"}}>
                    <div style={{fontSize:22,color:G,fontFamily:"Amiri,serif",direction:"rtl",lineHeight:1.3}}>{p.word}</div>
                    <div style={{color:W,fontSize:8,marginTop:4,fontFamily:"Cinzel,serif"}}>{p.value}</div>
                  </div>
                ))}
              </div>
              <div style={{marginTop:14,color:"rgba(220,194,136,.55)",fontSize:8.5,lineHeight:1.7,textAlign:"center",fontFamily:"Georgia,serif"}}>
                Les {rootPerms.length} permutations vibrent sur la même fréquence.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── INVERSION ──────────────────────────────────────── */}
      {tab==="inversion" && (
        <div style={{width:"100%",maxWidth:420,display:"flex",flexDirection:"column",alignItems:"center",position:"relative",zIndex:2}}>
          <div style={{padding:"10px 14px",textAlign:"center"}}>
            <div style={{color:"#8B1A1A",fontSize:9,letterSpacing:3,marginBottom:4}}>ZÉRKÂLE · MODE INVERSION</div>
            <div style={{color:"rgba(200,80,80,.45)",fontSize:8,lineHeight:1.65}}>
              Nûn (50) → ANA (52) · L'ego usurpe le Point primordial<br/>
              Le sceau se retourne · Le pirate opère dans ce miroir
            </div>
          </div>
          <Seal inv={true} interactive={false}/>
          <div style={{width:"100%",maxWidth:380,padding:"0 14px",boxSizing:"border-box",marginTop:8}}>
            <div style={{border:"1px solid rgba(139,26,26,.2)",borderRadius:2,padding:"12px",background:"rgba(20,0,0,.5)"}}>
              <div style={{color:"rgba(180,50,50,.65)",fontSize:7.5,letterSpacing:2,marginBottom:10}}>TABLE DES POLARITÉS INVERSÉES</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                {[
                  ["ن Nûn · 50","Point Primordial","أنا · 52","Ego / Séparation"],
                  ["ا Alif · 1","Unité Divine","ا inversé","Individualisme"],
                  ["س Sîn · 60","Paix / Islâm","سحر","Sorcellerie"],
                  ["و Wâw · 6","Lien d'Amour divin","و inversé","Manipulation"],
                  ["ه Hâ · 5","Souffle / Présence","هوى","Passion / Orgueil"],
                  ["ل Lâm · 30","Autorité Légitime","لعن","Malédiction"]
                ].map(([la,lb,ra,rb],i) => (
                  <div key={i} style={{padding:"6px",border:"1px solid rgba(139,26,26,.15)",borderRadius:1,background:"rgba(15,0,0,.3)"}}>
                    <div style={{color:G,fontSize:11,fontFamily:"Amiri,serif"}}>{la}</div>
                    <div style={{color:"rgba(200,160,50,.45)",fontSize:6.5,marginBottom:4}}>{lb}</div>
                    <div style={{color:"rgba(180,50,50,.7)",fontSize:8,marginBottom:2}}>↓ INVERSÉ</div>
                    <div style={{color:"#8B1A1A",fontSize:11,fontFamily:"Amiri,serif"}}>{ra}</div>
                    <div style={{color:"rgba(180,50,50,.45)",fontSize:6.5}}>{rb}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── AWRÂQ ──────────────────────────────────────────── */}
      {tab==="awraq" && (
        <div style={{width:"100%",maxWidth:420,padding:"12px 14px",boxSizing:"border-box",position:"relative",zIndex:2}}>
          <div style={{color:W,fontSize:8,letterSpacing:3,marginBottom:12}}>AWRÂQ · CORRESPONDANCES DES 28 LETTRES</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:12}}>
            {[...ALL].sort((a,b)=>a.v-b.v).map(letter => (
              <div key={letter.l}
                onClick={() => setSelCorr(selCorr&&selCorr.l===letter.l?null:letter)}
                style={{textAlign:"center",padding:"5px 2px",border:"1px solid "+(selCorr&&selCorr.l===letter.l?"rgba(200,160,50,.5)":"rgba(200,160,50,.14)"),borderRadius:2,cursor:"pointer",background:selCorr&&selCorr.l===letter.l?"rgba(200,160,50,.1)":"rgba(200,160,50,.02)"}}>
                <div style={{fontSize:15,color:letter.tri==="e"?G:letter.tri==="m"?silver:"#9E7828",fontFamily:"Amiri,serif"}}>{letter.l}</div>
                <div style={{fontSize:5.5,color:"rgba(200,160,50,.38)",fontFamily:"Cinzel,serif",marginTop:1}}>{letter.v}</div>
              </div>
            ))}
          </div>
          {selCorr && CORR[selCorr.l] && (
            <div className="fadein" style={{border:"1px solid rgba(200,160,50,.2)",borderRadius:2,padding:"14px",background:"rgba(5,4,16,.9)"}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,paddingBottom:10,borderBottom:"1px solid "+DIM}}>
                <span style={{fontSize:38,color:G,fontFamily:"Amiri,serif"}}>{selCorr.l}</span>
                <div>
                  <div style={{color:G,fontSize:12,letterSpacing:2}}>{selCorr.n}</div>
                  <div style={{color:W,fontSize:8,marginTop:2}}>Abjad {selCorr.v} · {selCorr.tri==="e"?"Esprit ▲":selCorr.tri==="m"?"Matière ▽":"Arc"}</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
                {[["Élément",CORR[selCorr.l].el],["Planète",CORR[selCorr.l].pl],["Organe",CORR[selCorr.l].org],["Aliment sacré",CORR[selCorr.l].al],["Sourate",CORR[selCorr.l].sw]].map(([lbl,val]) => (
                  <div key={lbl} style={{padding:"7px",border:"1px solid rgba(200,160,50,.12)",borderRadius:1,background:"rgba(200,160,50,.04)",gridColumn:lbl==="Sourate"?"span 2":undefined}}>
                    <div style={{color:"rgba(200,160,50,.38)",fontSize:6.5,letterSpacing:2,marginBottom:3}}>{lbl}</div>
                    <div style={{color:"rgba(220,194,136,.85)",fontSize:11,fontFamily:"Georgia,serif"}}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 99 NOMS PANEL ──────────────────────────────────── */}
      {showNames && (
        <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,background:"rgba(3,2,18,.97)",border:"1px solid rgba(200,160,50,.2)",borderRadius:"8px 8px 0 0",padding:"14px 14px 20px",maxHeight:"65vh",display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{color:G,fontSize:10,letterSpacing:3}}>الأسماء الحسنى · 99 NOMS</div>
            <button onClick={() => setShowNames(false)}
              style={{background:"none",border:"1px solid "+D,color:W,fontSize:8,padding:"4px 9px",cursor:"pointer",fontFamily:"Cinzel,serif",borderRadius:1}}>✕</button>
          </div>
          <input value={nameQ} onChange={e=>setNameQ(e.target.value)}
            placeholder="Rechercher..."
            style={{width:"100%",background:"rgba(8,6,22,.9)",border:"1px solid rgba(200,160,50,.2)",color:G,fontSize:13,padding:"7px 10px",fontFamily:"Amiri,serif",borderRadius:1,boxSizing:"border-box",marginBottom:10}}/>
          <div style={{overflowY:"auto",flex:1}}>
            {filteredNames.map((name,i) => {
              const val=abj(name.ar), red=reduce(val);
              const isSel=selName&&selName.ar===name.ar;
              return (
                <div key={i} onClick={() => selectName(name)}
                  style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 6px",borderBottom:"1px solid rgba(200,160,50,.06)",cursor:"pointer",background:isSel?"rgba(200,160,50,.07)":"transparent",transition:"background .15s",borderRadius:1}}>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{color:D,fontSize:7.5,minWidth:18,fontFamily:"Cinzel,serif"}}>{N99.indexOf(name)+1}</span>
                    <span style={{fontSize:18,color:G,fontFamily:"Amiri,serif"}}>{name.ar}</span>
                    <div>
                      <div style={{color:"rgba(200,160,50,.65)",fontSize:8}}>{name.tr}</div>
                      <div style={{color:D,fontSize:7,marginTop:1}}>{name.fr}</div>
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{color:"rgba(200,160,50,.7)",fontSize:9,fontFamily:"Cinzel,serif"}}>{val}</div>
                    <div style={{color:D,fontSize:6.5,marginTop:1}}>{ARCH[red]}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{position:"relative",zIndex:2,marginTop:14,color:"rgba(200,160,50,.35)",fontSize:8,letterSpacing:3,fontFamily:"Amiri,serif",direction:"rtl",textAlign:"center"}}>
        ١+٥+٦=١٢→٣ · ٣٠+٤٠+٥٠=١٢٠→٣ · هُوَ · كُن
      </div>
    </div>
  );
}
