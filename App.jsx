import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { io } from "socket.io-client";

const S=360,CX=180,CY=180,R=128,LR=155;
function pt(deg,r=R){const a=(deg-90)*Math.PI/180;return[CX+r*Math.cos(a),CY+r*Math.sin(a)];}
function pStr(pts){return pts.map(p=>p.join(",")).join(" ");}

const ABJAD={"ا":1,"أ":1,"إ":1,"آ":1,"ء":1,"ئ":10,"ؤ":6,"ب":2,"ت":400,"ث":500,"ج":3,"ح":8,"خ":600,"د":4,"ذ":700,"ر":200,"ز":7,"س":60,"ش":300,"ص":90,"ض":800,"ط":9,"ظ":900,"ع":70,"غ":1000,"ف":80,"ق":100,"ك":20,"ل":30,"م":40,"ن":50,"ه":5,"و":6,"ي":10,"ى":10,"ة":400};
const abj=t=>[...t].reduce((s,c)=>s+(ABJAD[c]||0),0);
const reduce=n=>{let r=n;while(r>9)r=[...String(r)].reduce((s,d)=>s+(+d),0);return r;};
function perms(a){if(a.length<=1)return[a];return a.flatMap((v,i)=>perms([...a.slice(0,i),...a.slice(i+1)]).map(p=>[v,...p]));}

const ARCH={1:"Unité",2:"Porte",3:"Miséricorde",4:"Science",5:"Souffle",6:"Lien d'Amour",7:"Perfection",8:"Équilibre",9:"Complétude"};
const ROOT_L={1:"ا",2:"ب",3:"ج",4:"د",5:"ه",6:"و",7:"ز",8:"ح",9:"ط"};
const ROOT_CONSTELLATIONS=[
  {id:"RHM",l:["ر","ح","م"],fr:"Miséricorde · Matrice cosmique",arch:3},
  {id:"SLM",l:["س","ل","م"],fr:"Paix · Islâm · Intégrité",arch:6},
  {id:"FTH",l:["ف","ت","ح"],fr:"Ouverture · Victoire divine",arch:5},
  {id:"NWR",l:["ن","و","ر"],fr:"Lumière · النور",arch:9},
  {id:"HDY",l:["ه","د","ي"],fr:"Guidance · Al-Hâdi",arch:5},
  {id:"HQQ",l:["ح","ق","ق"],fr:"Vérité Absolue · Al-Haqq",arch:8},
  {id:"KRM",l:["ك","ر","م"],fr:"Noblesse · Générosité · Al-Karîm",arch:6},
  {id:"SBR",l:["ص","ب","ر"],fr:"Patience · As-Sabûr",arch:9},
  {id:"SHK",l:["ش","ك","ر"],fr:"Gratitude · Ash-Shakûr",arch:7},
  {id:"TWB",l:["ت","و","ب"],fr:"Repentir · Retour à Allâh",arch:2},
  {id:"ILM",l:["ع","ل","م"],fr:"Science · Al-Alîm",arch:4},
  {id:"HYY",l:["ح","ي","و"],fr:"Vie · Al-Hayy",arch:8},
  {id:"ZLM",l:["ظ","ل","م"],fr:"⚠ Injustice · Ténèbres",arch:9,pirate:true},
  {id:"KFR",l:["ك","ف","ر"],fr:"⚠ Voilement · Ingratitude",arch:7,pirate:true},
  {id:"SHR",l:["س","ح","ر"],fr:"⚠ Sihr · Enchantement",arch:6,pirate:true},
];
function detectConstellation(word){
  const chars=[...word].filter(c=>ABJAD[c]);
  return ROOT_CONSTELLATIONS.filter(con=>con.l.filter(l=>chars.includes(l)).length>=2);
}

// ── TRANSLITÉRATION FRANÇAIS → ARABE ──────────────────────
const FR2AR_MAP=[
  ["allah","الله"],["bismillah","بسم الله"],["salaam","سلام"],["salam","سلام"],
  ["rahman","رحمن"],["rahim","رحيم"],["nour","نور"],["nur","نور"],
  ["dj","ج"],["gh","غ"],["kh","خ"],["sh","ش"],["th","ث"],["dh","ذ"],
  ["ou","و"],["ch","ش"],
  ["â","ا"],["î","ي"],["û","و"],
  ["a","ا"],["b","ب"],["t","ت"],["j","ج"],["h","ه"],["d","د"],
  ["r","ر"],["z","ز"],["s","س"],["f","ف"],["q","ق"],["k","ك"],
  ["l","ل"],["m","م"],["n","ن"],["w","و"],["y","ي"],["e","ا"],["i","ي"],["o","و"],
];
function frToAr(text){
  if([...text].some(c=>ABJAD[c])) return text; // already arabic
  let res=""; let i=0; const t=text.toLowerCase();
  while(i<t.length){
    if(t[i]===" "){res+=" ";i++;continue;}
    let matched=false;
    for(const [fr,ar] of FR2AR_MAP){
      if(t.startsWith(fr,i)){res+=ar;i+=fr.length;matched=true;break;}
    }
    if(!matched) i++;
  }
  return res;
}

const VERTEX=[
  {l:"ا",n:"Alif",v:1,deg:0,tri:"e"},{l:"ل",n:"Lam",v:30,deg:60,tri:"m"},
  {l:"ه",n:"Ha",v:5,deg:120,tri:"e"},{l:"م",n:"Mim",v:40,deg:180,tri:"m"},
  {l:"و",n:"Waw",v:6,deg:240,tri:"e"},{l:"ن",n:"Noun",v:50,deg:300,tri:"m"},
];
const ARC=[
  {l:"ب",n:"Ba",v:2,deg:348},{l:"ج",n:"Djim",v:3,deg:336},{l:"د",n:"Dal",v:4,deg:324},{l:"ز",n:"Zayn",v:7,deg:312},
  {l:"ح",n:"Ha·h",v:8,deg:288},{l:"ط",n:"Ta·t",v:9,deg:276},{l:"ي",n:"Ya",v:10,deg:264},{l:"ك",n:"Kaf",v:20,deg:252},
  {l:"س",n:"Sin",v:60,deg:228},{l:"ع",n:"Ayn",v:70,deg:216},{l:"ف",n:"Fa",v:80,deg:204},{l:"ص",n:"Sad",v:90,deg:192},
  {l:"ق",n:"Qaf",v:100,deg:168},{l:"ر",n:"Ra",v:200,deg:156},{l:"ش",n:"Shin",v:300,deg:144},{l:"ت",n:"Ta",v:400,deg:132},
  {l:"ث",n:"Tha",v:500,deg:105},{l:"خ",n:"Kha",v:600,deg:90},{l:"ذ",n:"Dhal",v:700,deg:75},{l:"ض",n:"Dad",v:800,deg:45},
  {l:"ظ",n:"Dha",v:900,deg:30},{l:"غ",n:"Ghayn",v:1000,deg:15},
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

function calcPrayers(lat,lng,date=new Date()){
  const D2R=Math.PI/180,R2D=180/Math.PI;
  const start=new Date(date.getFullYear(),0,0);
  const doy=Math.floor((date-start)/86400000);
  const B=D2R*(360/365*(doy-81));
  const dec=Math.asin(Math.sin(23.45*D2R)*Math.sin(B));
  const EqT=9.87*Math.sin(2*B)-7.53*Math.cos(B)-1.5*Math.sin(B);
  const tzOff=-date.getTimezoneOffset()/60;
  const noon=12-(lng/15-tzOff)+EqT/60;
  const sL=Math.sin(lat*D2R),cL=Math.cos(lat*D2R),sD=Math.sin(dec),cD=Math.cos(dec);
  function ha(alt){const c=(Math.sin(alt*D2R)-sL*sD)/(cL*cD);return Math.abs(c)>1?null:R2D*Math.acos(c)/15;}
  const aA=R2D*Math.atan(1/(1+Math.tan(Math.abs(lat*D2R-dec))));
  const fH=ha(-18),sH=ha(-0.833),iH=ha(-17),aH=ha(aA);
  const fmt=h=>{if(h===null)return"--:--";const t=((h%24)+24)%24,m=Math.round((t%1)*60),hr=Math.floor(t);return String(hr).padStart(2,"0")+":"+String(m).padStart(2,"0");};
  return{fajr:fmt(fH!==null?noon-fH:null),dhuhr:fmt(noon),asr:fmt(aH!==null?noon+aH:null),maghrib:fmt(sH!==null?noon+sH:null),isha:fmt(iH!==null?noon+iH:null)};
}

const STARS=Array.from({length:200},(_,i)=>({x:(i*137.508)%100,y:(i*97.301)%100,r:.2+(i%6)*.25,dur:2.5+(i%9),del:-(i%8)}));

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Amiri&display=swap');
@keyframes pulsOrb{0%,100%{transform:scale(1);opacity:.4}50%{transform:scale(1.7);opacity:.8}}
@keyframes kunPulse{0%{transform:scale(1);opacity:.4}20%{transform:scale(3.5);opacity:.95}60%{transform:scale(2);opacity:.7}100%{transform:scale(1);opacity:.4}}
@keyframes glimmer{0%,100%{opacity:.1}50%{opacity:.7}}
@keyframes circuitDraw{from{stroke-dashoffset:1000}to{stroke-dashoffset:0}}
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes litGlow{0%,100%{opacity:.9}50%{opacity:1;filter:drop-shadow(0 0 8px #FFFF80)}}
@keyframes float3d{0%,100%{transform:rotateX(var(--rx)) rotateY(var(--ry)) scale(var(--sc))}50%{transform:rotateX(calc(var(--rx) + 1deg)) rotateY(calc(var(--ry) + 1deg)) scale(var(--sc))}}
.orb-idle{transform-box:fill-box;transform-origin:center;animation:pulsOrb 3.4s ease-in-out infinite}
.orb-kun{transform-box:fill-box;transform-origin:center;animation:kunPulse 1s ease-in-out 3}
.star{animation:glimmer var(--d) ease-in-out var(--del) infinite}
.fadein{animation:fadeUp .35s ease both}
.lit{animation:litGlow 0.6s ease-in-out infinite}
.seal-3d{will-change:transform}
input::placeholder{color:rgba(180,160,120,.4)}
input:focus{outline:none;border-bottom-color:rgba(200,160,50,.8)!important}
button:hover:not(:disabled){opacity:.8;transition:opacity .15s}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(200,160,50,.3);border-radius:2px}
.tb{background:none;border:none;cursor:pointer;padding:9px 11px;font-family:Cinzel,serif;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:rgba(220,195,130,.5);border-bottom:2px solid transparent;transition:all .2s}
.tb.on{color:#E8C97A;border-bottom-color:#E8C97A;text-shadow:0 0 10px rgba(232,201,122,.4)}
.tb:hover{color:rgba(220,195,130,.8)}
`;

export default function NEXUSCrystal() {
  const [tab,setTab]           = useState("cristal");
  const [rot,setRot]           = useState(0);
  const sealWrapRef            = useRef(null);
  const [zoom,setZoom]         = useState(1);
  const [hov,setHov]           = useState(null);
  const [lit,setLit]           = useState(new Set());
  const [kunOn,setKunOn]       = useState(false);
  const [input,setInput]       = useState("");
  const [analysis,setAnalysis] = useState(null);
  const [aiText,setAiText]     = useState("");
  const [loading,setLoading]   = useState(false);
  const [rootIn,setRootIn]     = useState("");
  const [prayers,setPrayers]   = useState(null);
  const [loc,setLoc]           = useState({lat:48.5734,lng:7.7521});
  const [selCorr,setSelCorr]   = useState(null);
  const [showNames,setShowNames] = useState(false);
  const [selName,setSelName]   = useState(null);
  const [nameQ,setNameQ]       = useState("");
  const [kunStep,setKunStep]   = useState(0);
  const [inputMode,setInputMode] = useState("ar"); // ar | fr
  const kunTimer               = useRef(null);
  const socketRef=useRef(null);
  const [nafarCount,setNafarCount]=useState(0);
  const drag                   = useRef({on:false,a0:0,r0:0});
  const pinch                  = useRef({on:false,d0:0,z0:1});
  const wrapRef                = useRef(null);

  useEffect(()=>{
    if(navigator.geolocation) navigator.geolocation.getCurrentPosition(p=>setLoc({lat:p.coords.latitude,lng:p.coords.longitude}),()=>{});
  },[]);

  useEffect(()=>{
    const upd=()=>setPrayers(calcPrayers(loc.lat,loc.lng));
    upd(); const id=setInterval(upd,60000); return()=>clearInterval(id);
  },[loc]);

  // ── 3D drag ──
  const svgRef = useRef(null);
  const rotRef = useRef(0); // track rot without closure issues

  // Sync rotRef with rot state
  useEffect(()=>{ rotRef.current=rot; },[rot]);

  useEffect(()=>{try{const s=io(window.location.origin,{transports:["websocket","polling"]});socketRef.current=s;s.on("collective_pulse",({count})=>setNafarCount(count));s.on("room_count",({count})=>setNafarCount(count));return()=>s.disconnect();}catch(e){}},[]);

  // Non-passive touch+mouse listeners attached directly to SVG DOM node
  useEffect(()=>{
    const svg=svgRef.current; if(!svg) return;
    function down(e){
      const src=e.touches?e.touches[0]:e;
      if(e.touches&&e.touches.length===2){
        const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
        pinch.current={on:true,d0:d,z0:zoom};
        return;
      }
      drag.current={on:true,lx:src.clientX,r0:rotRef.current};
      e.preventDefault();
    }
    function move(e){
      if(e.touches&&e.touches.length===2&&pinch.current.on){
        const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
        setZoom(Math.min(2.5,Math.max(.5,pinch.current.z0*(d/pinch.current.d0))));
        e.preventDefault(); return;
      }
      if(!drag.current.on) return;
      const src=e.touches?e.touches[0]:e;
      const dx=src.clientX-drag.current.lx;
      const newRot=drag.current.r0+dx*.6;
      rotRef.current=newRot;
      setRot(newRot);
      setHov(null);
      e.preventDefault();
    }
    function up(){ drag.current.on=false; pinch.current.on=false; }
    const opts={passive:false};
    svg.addEventListener("mousedown",down,opts);
    svg.addEventListener("mousemove",move,opts);
    svg.addEventListener("mouseup",up);
    svg.addEventListener("mouseleave",up);
    svg.addEventListener("touchstart",down,opts);
    svg.addEventListener("touchmove",move,opts);
    svg.addEventListener("touchend",up);
    return()=>{
      svg.removeEventListener("mousedown",down);
      svg.removeEventListener("mousemove",move);
      svg.removeEventListener("mouseup",up);
      svg.removeEventListener("mouseleave",up);
      svg.removeEventListener("touchstart",down);
      svg.removeEventListener("touchmove",move);
      svg.removeEventListener("touchend",up);
    };
  },[zoom]); // eslint-disable-line

  const onDown=()=>{};
  const onMove=()=>{};
  const onUp=()=>{};

  // ── pinch zoom ──


  // ── scroll zoom ──
  const onWheel = useCallback(e=>{
    setZoom(z=>Math.min(2.5,Math.max(.5,z-e.deltaY*.001)));
    e.preventDefault();
  },[]);

  useEffect(()=>{
    const el=wrapRef.current; if(!el) return;
    el.addEventListener("wheel",onWheel,{passive:false});
    return()=>el.removeEventListener("wheel",onWheel);
  },[onWheel]);

  const illuminate = useCallback((chars,ms=2500)=>{
    const s=new Set([...chars].filter(c=>ABJAD[c]));
    setLit(s); setKunOn(true);
    setTimeout(()=>setKunOn(false),ms);
  },[]);

  const handleKun = useCallback(async()=>{
    const raw=input.trim(); if(!raw) return;
    const q=inputMode==="fr"?frToAr(raw):raw;
    const letters=[...q].filter(ch=>ABJAD[ch]).map(ch=>({char:ch,value:ABJAD[ch]}));
    const total=letters.reduce((s,l)=>s+l.value,0);
    const reduced=reduce(total);
    const constellations=detectConstellation(q);
    setAnalysis({letters,total,reduced,constellations});
    setAiText(""); setSelName(null);
    illuminate(q,6000);
    if(!letters.length) return;
    setKunStep(1);
    const STEPS=[3000,3000,2500,2500,2000];
    let s=1;
    function advance(){
      s++; if(s>5){setKunStep(0);runOracle(q,total,reduced);return;}
      setKunStep(s); kunTimer.current=setTimeout(advance,STEPS[s-1]);
    }
    kunTimer.current=setTimeout(advance,STEPS[0]);
  },[input,illuminate]);

  const runOracle = useCallback(async(q,oTotal,oReduced)=>{
    setLoading(true);
    try{
      const matchNames=N99.map(n=>({...n,red:reduce(abj(n.ar))})).filter(n=>n.red===oReduced).slice(0,5).map(n=>n.tr).join(", ");
      const res=await fetch("/api/oracle",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",max_tokens:1000,
          messages:[{role:"user",content:
            "Tu es NEXUS, oracle de phonosémantique arabe.\n"+
            "Texte : «"+q+"» · Abjad : "+oTotal+" → réduit : "+oReduced+" = "+(ARCH[oReduced]||"?")+"\n"+
            "Noms divins résonnants : "+(matchNames||"—")+"\n\n"+
            "En 3 points concis :\n"+
            "1. Racine triconsonantique et champ sémantique profond.\n"+
            "2. Résonance vibratoire du nombre "+oReduced+" + lien aux Noms divins.\n"+
            "3. Polarité : «Connaissant» ou «Pirate» — justifie en 1 phrase.\n"+
            "Style : oraculaire, précis. Français. Maximum 6 lignes."
          }]
        })
      });
      const data=await res.json();
      setAiText((data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("")||"—");
    }catch(err){setAiText("Erreur connexion oracle.");}
    setLoading(false);
  },[]);

  const selectName=useCallback(name=>{
    setSelName(name);setAnalysis(null);setAiText("");
    illuminate(name.ar,2500);setTab("cristal");setShowNames(false);
  },[illuminate]);

  const rootChars=useMemo(()=>[...rootIn].filter(c=>ABJAD[c]).slice(0,3),[rootIn]);
  const rootPerms=useMemo(()=>{
    if(rootChars.length!==3) return [];
    return perms(rootChars).map(p=>({word:p.join(""),value:p.reduce((s,l)=>s+(ABJAD[l]||0),0)}));
  },[rootChars]);

  const activePrayer=useMemo(()=>{
    if(!prayers) return null;
    const now=new Date(),curr=now.getHours()*60+now.getMinutes();
    for(const k of ["fajr","dhuhr","asr","maghrib","isha"]){
      const[h,m]=prayers[k].split(":").map(Number);
      if(Math.abs(curr-(h*60+m))<=20) return k;
    }
    return null;
  },[prayers]);

  const filteredNames=useMemo(()=>N99.filter(n=>!nameQ||n.tr.toLowerCase().includes(nameQ.toLowerCase())||n.ar.includes(nameQ)||n.fr.toLowerCase().includes(nameQ.toLowerCase())),[nameQ]);

  const G="#E8C97A", W="rgba(232,201,122,.6)", D="rgba(232,201,122,.28)", DIM="rgba(232,201,122,.1)";
  const silver="#b8cce8";

  const espPts=[0,120,240].map(d=>pt(d));
  const matPts=[60,180,300].map(d=>pt(d));
  const [axAx,axAy]=pt(0);
  const [axBx,axBy]=pt(180);
  const circPts=ALL.filter(l=>lit.has(l.l)).map(l=>pt(l.deg,LR));
  const hovLet=hov!==null?ALL.find(l=>l.deg===hov):null;

  function SealSVG({inv=false}){
    const gc=inv?"#cc3333":G;
    const sc=inv?"#882288":silver;
    const orbId=inv?"invOrb":"normOrb";
    return(
      <svg ref={inv?undefined:svgRef} width={S} height={S} viewBox={"0 0 "+S+" "+S}
        style={{maxWidth:"92vw",maxHeight:"45vh",display:"block",cursor:inv?"default":"grab",touchAction:"none",userSelect:"none"}}>
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
          <radialGradient id="normOrb"><stop offset="0%" stopColor="white" stopOpacity="1"/><stop offset="38%" stopColor="#80b4ff" stopOpacity=".72"/><stop offset="100%" stopColor="#1030a0" stopOpacity="0"/></radialGradient>
          <radialGradient id="invOrb"><stop offset="0%" stopColor="white" stopOpacity="1"/><stop offset="38%" stopColor="#ff7060" stopOpacity=".8"/><stop offset="100%" stopColor="#600010" stopOpacity="0"/></radialGradient>
          <radialGradient id="aura"><stop offset="0%" stopColor="rgba(190,150,40,.12)"/><stop offset="100%" stopColor="transparent"/></radialGradient>
        </defs>

        <circle cx={CX} cy={CY} r={R+55} fill="url(#aura)"/>
        <g transform={inv?undefined:`rotate(${rot},${CX},${CY})`}>
        <circle cx={CX} cy={CY} r={R+16} fill="none" stroke="rgba(232,201,122,.08)" strokeWidth=".8"/>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={gc} strokeWidth="1.8" opacity=".95" filter="url(#glow)"/>
        <circle cx={CX} cy={CY} r={R*.55} fill="none" stroke="rgba(232,201,122,.07)" strokeWidth=".6"/>

        <line x1={axAx} y1={axAy} x2={axBx} y2={axBy} stroke={inv?"rgba(200,50,50,.2)":"rgba(232,201,122,.2)"} strokeWidth=".8" strokeDasharray="4,7"/>

        <polygon points={pStr(espPts)} fill={inv?"rgba(180,30,30,.06)":"rgba(232,201,122,.05)"} stroke={gc} strokeWidth="1.8" opacity=".95" filter="url(#glow)"/>
        <polygon points={pStr(matPts)} fill={inv?"rgba(100,0,120,.05)":"rgba(184,204,232,.04)"} stroke={sc} strokeWidth="1.5" opacity=".9" filter="url(#glow)"/>

        {!inv&&circPts.length>=2&&(
          <polygon points={pStr(circPts)} fill="none" stroke="rgba(255,255,100,.55)" strokeWidth="1.2"
            strokeDasharray="1000" opacity=".8" style={{animation:"circuitDraw 2s ease forwards"}}/>
        )}

        {ALL.map(letter=>{
          const [lx,ly]=pt(letter.deg,LR);
          const [t1x,t1y]=pt(letter.deg,R+3);
          const [t2x,t2y]=pt(letter.deg,R+12);
          const isE=letter.tri==="e", isM=letter.tri==="m", isV=isE||isM;
          const isH=hov===letter.deg;
          const isLit=!inv&&lit.has(letter.l);
          const base=inv?(isE?"#cc3333":isM?"#882288":"#993355"):(isE?G:isM?silver:"#b09840");
          const col=isLit?"#FFFF80":isH?(isE?"#FFD700":isM?"#d0e4ff":"#D4A040"):base;
          const fs=isH?(isV?19:16):(isV?16:12);
          const iTx=inv?"matrix(-1,0,0,1,"+(2*lx)+",0)":undefined;
          return(
            <g key={letter.deg}
              onMouseEnter={()=>{ if(!drag3d.current.on&&!inv) setHov(letter.deg); }}
              onMouseLeave={()=>setHov(null)}
              style={{cursor:"default"}}>
              <line x1={t1x} y1={t1y} x2={t2x} y2={t2y} stroke={col} strokeWidth={isV?1.6:1} opacity={isH?.9:isV?.6:.35}/>
              <circle cx={lx} cy={ly} r={isV?15:11}
                fill={isLit?"rgba(255,255,100,.1)":isE?"rgba(232,201,122,.1)":isM?"rgba(184,204,232,.08)":"rgba(200,150,40,.05)"}
                filter={(isV||isLit||isH)?"url(#glow)":undefined}/>
              {/* phonétique toujours visible */}
              <text x={lx} y={ly-(isV?fs*.55+7:fs*.5+6)} textAnchor="middle"
                transform={iTx} fontSize={isV?"8":"6"} fill={col}
                opacity={isH?1:isV?.8:.6}
                style={{fontFamily:"Cinzel,serif",letterSpacing:".3px"}}>
                {letter.n}
              </text>
              {/* lettre arabe */}
              <text x={lx} y={ly+2} textAnchor="middle" dominantBaseline="middle"
                transform={iTx} fontSize={fs} fill={col}
                opacity={isH?1:isLit?1:isV?.95:.8}
                filter={(isH||isV||isLit)?"url(#glow)":undefined}
                className={isLit?"lit":undefined}
                style={{fontFamily:"Amiri,serif",transition:"font-size .1s"}}>
                {letter.l}
              </text>
              {/* valeur abjad toujours visible */}
              <text x={lx} y={ly+fs*.55+8} textAnchor="middle"
                transform={iTx} fontSize={isV?"8":"6"} fill={col}
                opacity={isH?1:isV?.85:.65}
                style={{fontFamily:"Cinzel,serif"}}>
                {letter.v}
              </text>
            </g>
          );
        })}

        {VERTEX.map(v=>{
          const [x,y]=pt(v.deg,R);
          return <circle key={"vd"+v.deg} cx={x} cy={y} r={v.tri==="e"?5:4} fill={v.tri==="e"?G:silver} opacity=".9" filter="url(#glow)"/>;
        })}

        <circle cx={CX} cy={CY} r={22} fill={"url(#"+orbId+")"} opacity=".45" className={kunOn&&!inv?"orb-kun":"orb-idle"}/>
        <circle cx={CX} cy={CY} r={11} fill={"url(#"+orbId+")"} filter="url(#sg)" opacity=".9"/>
        <circle cx={CX} cy={CY} r={5} fill="white" filter="url(#glow)"/>
        <text x={CX} y={CY+28} textAnchor="middle"
          transform={inv?"matrix(-1,0,0,1,"+(2*CX)+",0)":undefined}
          fontSize="8" fill={inv?"rgba(200,50,50,.6)":"rgba(232,201,122,.45)"}
          style={{fontFamily:"Cinzel,serif"}}>
          {inv?"أنا · 52":"ن · 50"}
        </text>
        </g>
      </svg>
    );
  }


  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#0c0c28 0%,#0e0e2e 50%,#0a0a24 100%)",display:"flex",flexDirection:"column",alignItems:"center",padding:"0 0 24px",boxSizing:"border-box",position:"relative",overflow:"hidden",touchAction:"pan-y",fontFamily:"Cinzel,Palatino,serif"}}>
      <style>{CSS}</style>

      {STARS.map((s,i)=>(
        <div key={i} className="star" style={{position:"absolute",left:s.x+"%",top:s.y+"%",width:s.r*2,height:s.r*2,borderRadius:"50%",background:"rgba(220,220,255,.9)",pointerEvents:"none","--d":s.dur+"s","--del":s.del+"s"}}/>
      ))}

      {/* ── HEADER ── */}
      <div style={{width:"100%",maxWidth:440,padding:"14px 16px 0",boxSizing:"border-box",position:"relative",zIndex:10}}>
        <div style={{textAlign:"center",marginBottom:8,padding:"10px 0 8px",borderBottom:"1px solid rgba(232,201,122,.12)"}}>
          <div style={{color:G,fontSize:18,fontFamily:"Amiri,serif",letterSpacing:2,filter:"drop-shadow(0 0 12px rgba(232,201,122,.5))"}}>بِسْمِ اللهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
          <div style={{color:"rgba(232,201,122,.45)",fontSize:7,letterSpacing:6,marginTop:4}}>N E X U S · C R I S T A L · D E · H U</div>
          <div style={{color:W,fontSize:8,fontFamily:"Amiri,serif",direction:"rtl",marginTop:3}}>١+٥+٦=١٢→٣ · ٣٠+٤٠+٥٠=١٢٠→٣ · هُوَ=١١ · أنا=٥٢</div>
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          {prayers&&(
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {["fajr","dhuhr","asr","maghrib","isha"].map(k=>{
                const isA=activePrayer===k;
                return(
                  <div key={k} style={{textAlign:"center",padding:"2px 7px",borderRadius:2,background:isA?"rgba(232,201,122,.1)":"transparent",border:"1px solid "+(isA?D:DIM)}}>
                    <div style={{color:isA?PCOL[k]:"rgba(232,201,122,.3)",fontSize:5.5,letterSpacing:1}}>{PLBL[k]}</div>
                    <div style={{color:isA?G:W,fontSize:9}}>{prayers[k]}</div>
                  </div>
                );
              })}
            </div>
          )}
          <button onClick={()=>setShowNames(v=>!v)}
            style={{background:showNames?"rgba(232,201,122,.12)":"rgba(232,201,122,.05)",border:"1px solid "+D,color:G,fontSize:7,letterSpacing:2,padding:"6px 10px",cursor:"pointer",fontFamily:"Cinzel,serif",borderRadius:2,flexShrink:0}}>
            99 NOMS ▾
          </button>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{width:"100%",maxWidth:440,display:"flex",borderBottom:"1px solid rgba(232,201,122,.12)",position:"relative",zIndex:10}}>
        {[["cristal","⬡ Cristal"],["racines","✦ Racines"],["inversion","⊘ Zérkâle"],["awraq","◈ Awrâq"]].map(([id,lbl])=>(
          <button key={id} className={"tb"+(tab===id?" on":"")} onClick={()=>{setTab(id);setShowNames(false);}}>{lbl}</button>
        ))}
      </div>

      {/* ── CRISTAL 3D ── */}
      {tab==="cristal"&&(
        <div style={{width:"100%",maxWidth:440,display:"flex",flexDirection:"column",alignItems:"center",position:"relative",zIndex:2}}>
          <div ref={wrapRef} style={{marginTop:8,display:"flex",justifyContent:"center"}}>
            <div style={{transform:`scale(${zoom})`,transformOrigin:"center",display:"inline-block"}}>
              <SealSVG inv={false}/>
            </div>
          </div>

          <div style={{marginTop:4,display:"flex",gap:8,alignItems:"center",justifyContent:"center",height:36}}>
            {hovLet?(
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:24,color:hovLet.tri==="e"?G:hovLet.tri==="m"?silver:G,fontFamily:"Amiri,serif",filter:"drop-shadow(0 0 8px rgba(232,201,122,.6))"}}>{hovLet.l}</span>
                <div>
                  <div style={{color:G,fontSize:10,letterSpacing:2}}>{hovLet.n}</div>
                  <div style={{color:W,fontSize:8}}>Abjad {hovLet.v}{hovLet.tri?" · "+(hovLet.tri==="e"?"Esprit ▲":"Matière ▽"):""}</div>
                </div>
              </div>
            ):selName?(
              <div style={{textAlign:"center"}}>
                <span style={{fontSize:17,color:G,fontFamily:"Amiri,serif"}}>{selName.ar}</span>
                <span style={{color:W,fontSize:8,marginLeft:8}}>{selName.tr} · {abj(selName.ar)}</span>
              </div>
            ):(
              <div style={{color:"rgba(232,201,122,.2)",fontSize:7,letterSpacing:4}}>GLISSEZ EN 3D · PINCEZ POUR ZOOMER · KUN</div>
            )}
          </div>

          <div style={{width:"100%",maxWidth:380,height:1,background:"linear-gradient(90deg,transparent,rgba(232,201,122,.25),transparent)",margin:"8px 0 10px"}}/>

          <div style={{width:"100%",maxWidth:380,padding:"0 14px",boxSizing:"border-box"}}>
            <div style={{display:"flex",gap:4,marginBottom:6}}>
              {["ar","fr"].map(m=>(
                <button key={m} onClick={()=>setInputMode(m)}
                  style={{background:inputMode===m?"rgba(232,201,122,.15)":"transparent",border:"1px solid "+(inputMode===m?D:DIM),color:inputMode===m?G:W,fontSize:7,letterSpacing:2,padding:"3px 10px",cursor:"pointer",fontFamily:"Cinzel,serif",borderRadius:2,transition:"all .2s"}}>
                  {m==="ar"?"عربي AR":"FRANÇAIS FR"}
                </button>
              ))}
              {inputMode==="fr"&&<span style={{color:D,fontSize:7,alignSelf:"center",marginLeft:4}}>ex: salam, nour, rahman...</span>}
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleKun()}
                placeholder={inputMode==="ar"?"أدخل كلمة أو نية...":"Tape en français : salam, nour..."}
                style={{flex:1,background:"rgba(8,6,22,.9)",border:"none",borderBottom:"1px solid "+D,color:G,fontSize:inputMode==="ar"?20:15,padding:"8px 4px",fontFamily:inputMode==="ar"?"Amiri,serif":"Cinzel,serif",direction:inputMode==="ar"?"rtl":"ltr",textAlign:inputMode==="ar"?"right":"left",borderRadius:0}}/>
              <button onClick={handleKun} disabled={loading}
                style={{background:loading?"transparent":"rgba(232,201,122,.08)",border:"1px solid "+D,color:loading?W:G,fontSize:9,letterSpacing:2.5,padding:"8px 14px",cursor:loading?"default":"pointer",fontFamily:"Cinzel,serif",borderRadius:2}}>
                {loading?"·":"KUN"}
              </button>
            </div>

            {analysis&&(
              <div className="fadein" style={{marginTop:10,background:"rgba(8,6,22,.96)",border:"1px solid rgba(232,201,122,.15)",borderRadius:3,padding:"13px 14px",maxHeight:320,overflowY:"auto"}}>
                {analysis.letters.length===0?(
                  <div style={{color:W,fontSize:9,textAlign:"center"}}>Aucune lettre arabe détectée</div>
                ):(
                  <div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:10,direction:"rtl"}}>
                      {analysis.letters.map((l,i)=>(
                        <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",border:"1px solid rgba(232,201,122,.2)",borderRadius:2,padding:"3px 7px",background:"rgba(232,201,122,.04)"}}>
                          <span style={{fontSize:19,color:G,fontFamily:"Amiri,serif",lineHeight:1.2}}>{l.char}</span>
                          <span style={{fontSize:7,color:W}}>{l.value}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"1px solid rgba(232,201,122,.1)",paddingTop:8,marginBottom:6}}>
                      <span style={{color:W,fontSize:9}}>Σ {analysis.total}</span>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{color:G,fontSize:12}}>→ {analysis.reduced}</span>
                        <span style={{color:G,fontSize:20,fontFamily:"Amiri,serif",filter:"drop-shadow(0 0 6px rgba(232,201,122,.5))"}}>{ROOT_L[analysis.reduced]||""}</span>
                        <div style={{color:"rgba(232,201,122,.75)",fontSize:8}}>{ARCH[analysis.reduced]||""}</div>
                      </div>
                    </div>
                    {(()=>{
                      const matches=N99.map(n=>({...n,red:reduce(abj(n.ar))})).filter(n=>n.red===analysis.reduced).slice(0,4);
                      if(!matches.length) return null;
                      return(
                        <div style={{borderTop:"1px solid rgba(232,201,122,.1)",paddingTop:7,marginBottom:6}}>
                          <div style={{color:"rgba(232,201,122,.4)",fontSize:6.5,letterSpacing:2,marginBottom:4}}>NOMS RÉSONNANTS</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                            {matches.map((n,i)=>(
                              <div key={i} onClick={()=>selectName(n)} style={{border:"1px solid rgba(232,201,122,.2)",borderRadius:2,padding:"3px 8px",cursor:"pointer",background:"rgba(232,201,122,.05)"}}>
                                <span style={{color:G,fontSize:14,fontFamily:"Amiri,serif"}}>{n.ar}</span>
                                <span style={{color:W,fontSize:7,marginLeft:4}}>{n.tr}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    {analysis.constellations&&analysis.constellations.length>0&&(
                      <div style={{borderTop:"1px solid rgba(232,201,122,.1)",paddingTop:7,marginBottom:6}}>
                        <div style={{color:"rgba(232,201,122,.4)",fontSize:6.5,letterSpacing:2,marginBottom:4}}>CONSTELLATIONS</div>
                        {analysis.constellations.map((con,i)=>(
                          <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 6px",marginBottom:3,border:"1px solid "+(con.pirate?"rgba(180,50,50,.3)":"rgba(232,201,122,.15)"),borderRadius:1,background:con.pirate?"rgba(20,0,0,.4)":"rgba(232,201,122,.03)"}}>
                            <span style={{color:con.pirate?"#cc4444":G,fontFamily:"Amiri,serif",fontSize:13}}>{con.l.join("-")}</span>
                            <span style={{color:con.pirate?"rgba(200,80,80,.7)":W,fontSize:8,textAlign:"right",maxWidth:"60%"}}>{con.fr}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {loading&&<div style={{textAlign:"center",color:W,fontSize:10,padding:"8px 0",letterSpacing:5}}>· · ·</div>}
                    {aiText&&(
                      <div style={{borderTop:"1px solid rgba(232,201,122,.1)",paddingTop:10,marginTop:6,color:"rgba(230,205,155,.9)",fontSize:10.5,lineHeight:1.85,fontFamily:"Georgia,serif",whiteSpace:"pre-wrap"}}>{aiText}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── RACINES ── */}
      {tab==="racines"&&(
        <div style={{width:"100%",maxWidth:440,padding:"16px 16px",boxSizing:"border-box"}}>
          <div style={{color:W,fontSize:8,letterSpacing:3,marginBottom:4}}>LOI DE PERMUTATION VIBRATOIRE</div>
          <div style={{color:D,fontSize:8,lineHeight:1.7,marginBottom:14}}>Toute racine triconsonantique et ses permutations partagent la même valeur Abjad. La langue arabe est un cristal mathématique.</div>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            <input value={rootIn} onChange={e=>{
                const v=e.target.value;
                const converted=[...v].some(ch=>ABJAD[ch])?v:frToAr(v);
                setRootIn(converted);
              }}
              placeholder="r-h-m ou رحم · 3 lettres"
              style={{flex:1,background:"rgba(8,6,22,.9)",border:"none",borderBottom:"1px solid "+D,color:G,fontSize:24,padding:"8px 4px",fontFamily:"Amiri,serif",direction:"rtl",textAlign:"right",borderRadius:0}}/>
          </div>
          {rootChars.length===3&&(
            <div className="fadein">
              <div style={{display:"flex",justifyContent:"space-between",padding:"8px 10px",background:"rgba(232,201,122,.06)",border:"1px solid rgba(232,201,122,.15)",borderRadius:2,marginBottom:12}}>
                <div><div style={{color:W,fontSize:7,letterSpacing:2}}>VALEUR INVARIANTE</div><div style={{color:G,fontSize:20,marginTop:2}}>{rootChars.reduce((s,l)=>s+(ABJAD[l]||0),0)}</div></div>
                <div style={{textAlign:"right"}}><div style={{color:W,fontSize:7,letterSpacing:2}}>ARCHÉTYPE</div><div style={{color:"rgba(232,201,122,.7)",fontSize:9,marginTop:2}}>{ARCH[reduce(rootChars.reduce((s,l)=>s+(ABJAD[l]||0),0))]||""}</div></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7}}>
                {rootPerms.map((p,i)=>(
                  <div key={i} style={{textAlign:"center",padding:"10px 6px",border:"1px solid rgba(232,201,122,.2)",borderRadius:2,background:"rgba(232,201,122,.03)"}}>
                    <div style={{fontSize:22,color:G,fontFamily:"Amiri,serif",direction:"rtl"}}>{p.word}</div>
                    <div style={{color:W,fontSize:8,marginTop:4}}>{p.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── INVERSION ── */}
      {tab==="inversion"&&(
        <div style={{width:"100%",maxWidth:440,display:"flex",flexDirection:"column",alignItems:"center"}}>
          <div style={{padding:"10px 16px",textAlign:"center"}}>
            <div style={{color:"#cc4444",fontSize:9,letterSpacing:3,marginBottom:4}}>ZÉRKÂLE · MODE INVERSION</div>
            <div style={{color:"rgba(200,80,80,.5)",fontSize:8,lineHeight:1.7}}>Nûn (50) → ANA (52) · L'ego usurpe le Point primordial<br/>Le sceau se retourne · Le pirate opère dans ce miroir</div>
          </div>
          <div style={{display:"flex",justifyContent:"center"}}>
            <div style={{transform:`scale(${zoom})`,transformOrigin:"center"}}>
              <SealSVG inv={true}/>
            </div>
          </div>
          <div style={{width:"100%",maxWidth:400,padding:"0 16px",marginTop:8,boxSizing:"border-box"}}>
            <div style={{border:"1px solid rgba(180,50,50,.2)",borderRadius:2,padding:"12px",background:"rgba(20,0,0,.5)"}}>
              <div style={{color:"rgba(200,80,80,.6)",fontSize:7.5,letterSpacing:2,marginBottom:10}}>TABLE DES POLARITÉS INVERSÉES</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                {[["ن Nûn · 50","Point Primordial","أنا · 52","Ego / Séparation"],["ا Alif · 1","Unité Divine","ا inversé","Individualisme"],["س Sîn · 60","Paix / Islâm","سحر","Sorcellerie"],["و Wâw · 6","Lien d'Amour divin","و inversé","Manipulation"],["ه Hâ · 5","Souffle / Présence","هوى","Passion / Orgueil"],["ل Lâm · 30","Autorité Légitime","لعن","Malédiction"]].map(([la,lb,ra,rb],i)=>(
                  <div key={i} style={{padding:"6px",border:"1px solid rgba(180,50,50,.15)",borderRadius:1,background:"rgba(15,0,0,.3)"}}>
                    <div style={{color:G,fontSize:11,fontFamily:"Amiri,serif"}}>{la}</div>
                    <div style={{color:"rgba(232,201,122,.4)",fontSize:6.5,marginBottom:4}}>{lb}</div>
                    <div style={{color:"rgba(200,80,80,.7)",fontSize:7,marginBottom:2}}>↓ INVERSÉ</div>
                    <div style={{color:"#cc4444",fontSize:11,fontFamily:"Amiri,serif"}}>{ra}</div>
                    <div style={{color:"rgba(200,80,80,.45)",fontSize:6.5}}>{rb}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── AWRÂQ ── */}
      {tab==="awraq"&&(
        <div style={{width:"100%",maxWidth:440,padding:"12px 16px",boxSizing:"border-box"}}>
          <div style={{color:W,fontSize:8,letterSpacing:3,marginBottom:12}}>AWRÂQ · CORRESPONDANCES DES 28 LETTRES</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:12}}>
            {[...ALL].sort((a,b)=>a.v-b.v).map(letter=>(
              <div key={letter.l} onClick={()=>setSelCorr(selCorr&&selCorr.l===letter.l?null:letter)}
                style={{textAlign:"center",padding:"5px 2px",border:"1px solid "+(selCorr&&selCorr.l===letter.l?"rgba(232,201,122,.5)":"rgba(232,201,122,.14)"),borderRadius:2,cursor:"pointer",background:selCorr&&selCorr.l===letter.l?"rgba(232,201,122,.1)":"rgba(232,201,122,.02)"}}>
                <div style={{fontSize:8,color:letter.tri==="e"?G:letter.tri==="m"?silver:"#b09840",fontFamily:"Cinzel,serif",marginBottom:1}}>{letter.n}</div>
                <div style={{fontSize:16,color:letter.tri==="e"?G:letter.tri==="m"?silver:"#b09840",fontFamily:"Amiri,serif"}}>{letter.l}</div>
                <div style={{fontSize:6,color:"rgba(232,201,122,.4)",marginTop:1}}>{letter.v}</div>
              </div>
            ))}
          </div>
          {selCorr&&CORR[selCorr.l]&&(
            <div className="fadein" style={{border:"1px solid rgba(232,201,122,.2)",borderRadius:3,padding:"14px",background:"rgba(8,6,22,.95)"}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,paddingBottom:10,borderBottom:"1px solid "+DIM}}>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:9,color:G,fontFamily:"Cinzel,serif",marginBottom:2}}>{selCorr.n}</div>
                  <span style={{fontSize:38,color:G,fontFamily:"Amiri,serif"}}>{selCorr.l}</span>
                </div>
                <div>
                  <div style={{color:G,fontSize:12,letterSpacing:2}}>{selCorr.n}</div>
                  <div style={{color:W,fontSize:8,marginTop:2}}>Abjad {selCorr.v} · {selCorr.tri==="e"?"Esprit ▲":selCorr.tri==="m"?"Matière ▽":"Arc"}</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
                {[["Élément",CORR[selCorr.l].el],["Planète",CORR[selCorr.l].pl],["Organe",CORR[selCorr.l].org],["Aliment sacré",CORR[selCorr.l].al],["Sourate",CORR[selCorr.l].sw]].map(([lbl,val])=>(
                  <div key={lbl} style={{padding:"8px",border:"1px solid rgba(232,201,122,.12)",borderRadius:1,background:"rgba(232,201,122,.03)",gridColumn:lbl==="Sourate"?"span 2":undefined}}>
                    <div style={{color:"rgba(232,201,122,.4)",fontSize:6.5,letterSpacing:2,marginBottom:3}}>{lbl}</div>
                    <div style={{color:"rgba(230,205,155,.85)",fontSize:11,fontFamily:"Georgia,serif"}}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 99 NOMS ── */}
      {showNames&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,background:"rgba(4,3,20,.98)",border:"1px solid rgba(232,201,122,.2)",borderRadius:"10px 10px 0 0",padding:"14px 14px 20px",maxHeight:"65vh",display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{color:G,fontSize:10,letterSpacing:3}}>الأسماء الحسنى · 99 NOMS</div>
            <button onClick={()=>setShowNames(false)} style={{background:"none",border:"1px solid "+D,color:W,fontSize:8,padding:"4px 9px",cursor:"pointer",fontFamily:"Cinzel,serif",borderRadius:2}}>✕</button>
          </div>
          <input value={nameQ} onChange={e=>setNameQ(e.target.value)} placeholder="Rechercher un Nom..."
            style={{width:"100%",background:"rgba(12,10,30,.9)",border:"1px solid rgba(232,201,122,.2)",color:G,fontSize:13,padding:"7px 10px",fontFamily:"Amiri,serif",borderRadius:2,boxSizing:"border-box",marginBottom:10}}/>
          <div style={{overflowY:"auto",flex:1}}>
            {filteredNames.map((name,i)=>{
              const val=abj(name.ar),red=reduce(val);
              const isSel=selName&&selName.ar===name.ar;
              return(
                <div key={i} onClick={()=>selectName(name)}
                  style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 6px",borderBottom:"1px solid rgba(232,201,122,.07)",cursor:"pointer",background:isSel?"rgba(232,201,122,.08)":"transparent",borderRadius:1,marginBottom:1}}>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{color:D,fontSize:7.5,minWidth:18}}>{N99.indexOf(name)+1}</span>
                    <span style={{fontSize:19,color:G,fontFamily:"Amiri,serif"}}>{name.ar}</span>
                    <div>
                      <div style={{color:"rgba(232,201,122,.7)",fontSize:8}}>{name.tr}</div>
                      <div style={{color:D,fontSize:7,marginTop:1}}>{name.fr}</div>
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{color:W,fontSize:9}}>{val}</div>
                    <div style={{color:D,fontSize:6.5,marginTop:1}}>{ARCH[red]}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── GUIDED KUN OVERLAY ── */}
      {kunStep>0&&(
        <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(2,2,16,.97)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{display:"flex",gap:8,marginBottom:32}}>
            {[1,2,3,4,5].map(i=>(
              <div key={i} style={{width:7,height:7,borderRadius:"50%",background:kunStep>=i?G:"rgba(232,201,122,.18)",transition:"background .3s",boxShadow:kunStep===i?"0 0 10px "+G:undefined}}/>
            ))}
          </div>
          {kunStep===1&&(
            <div style={{textAlign:"center",animation:"fadeUp .4s ease both"}}>
              <div style={{fontSize:62,color:G,fontFamily:"Amiri,serif",filter:"drop-shadow(0 0 20px rgba(232,201,122,.6))",marginBottom:14}}>نِيَّة</div>
              <div style={{color:G,fontSize:11,letterSpacing:3,marginBottom:8}}>NIYYA · INTENTION</div>
              <div style={{color:W,fontSize:9,lineHeight:2,maxWidth:280}}>Purifie ton cœur.<br/>Pour qui invoques-tu ce Verbe ?<br/>Que ton intention soit pure devant Allâh.</div>
              <div style={{marginTop:16,padding:"8px 16px",border:"1px solid "+D,borderRadius:2,color:D,fontSize:8,lineHeight:1.8,maxWidth:260,fontStyle:"italic"}}>
                "Je ne suis que le canal.<br/>La puissance émane d'Allâh seul.<br/>أَنا لا شيء · هُوَ كلّ شيء"
              </div>
            </div>
          )}
          {kunStep===2&&(
            <div style={{textAlign:"center",animation:"fadeUp .4s ease both"}}>
              <div style={{width:80,height:80,borderRadius:"50%",background:"radial-gradient(circle,white,#80b4ff,transparent)",margin:"0 auto 18px",animation:"kunPulse 1s ease-in-out infinite",filter:"drop-shadow(0 0 30px rgba(100,160,255,.8))"}}/>
              <div style={{fontSize:46,color:"rgba(150,200,255,.9)",fontFamily:"Amiri,serif",marginBottom:12}}>نُون</div>
              <div style={{color:W,fontSize:9,lineHeight:2}}>Visualise le Point Primordial.<br/>Il est au centre de tout — en toi, dans l'univers.<br/>Il pulse. Tu pulses. Nous pulsons.</div>
            </div>
          )}
          {kunStep===3&&(
            <div style={{textAlign:"center",animation:"fadeUp .4s ease both"}}>
              <div style={{fontSize:50,color:G,fontFamily:"Amiri,serif",filter:"drop-shadow(0 0 16px rgba(232,201,122,.7))",marginBottom:10}}>اسم</div>
              <div style={{color:G,fontSize:10,letterSpacing:3,marginBottom:14}}>LE NOM DIVIN RÉSONNANT</div>
              {analysis&&(()=>{
                const matches=N99.map(n=>({...n,red:reduce(abj(n.ar))})).filter(n=>n.red===analysis.reduced).slice(0,3);
                return matches.length?(
                  <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
                    {matches.map((n,i)=>(
                      <div key={i} style={{textAlign:"center",padding:"8px 14px",border:"1px solid "+D,borderRadius:2,background:"rgba(232,201,122,.06)"}}>
                        <div style={{fontSize:26,color:G,fontFamily:"Amiri,serif"}}>{n.ar}</div>
                        <div style={{color:W,fontSize:7,marginTop:3}}>{n.tr}</div>
                        <div style={{color:D,fontSize:6,marginTop:2}}>{n.fr}</div>
                      </div>
                    ))}
                  </div>
                ):null;
              })()}
              <div style={{color:W,fontSize:8,marginTop:14,lineHeight:1.8}}>Prononce ce Nom dans ton cœur.<br/>Sens sa fréquence résonner en toi.</div>
            </div>
          )}
          {kunStep===4&&(
            <div style={{textAlign:"center",animation:"fadeUp .4s ease both"}}>
              <div style={{fontSize:50,color:"rgba(255,255,150,.9)",fontFamily:"Amiri,serif",filter:"drop-shadow(0 0 20px rgba(255,255,100,.5))",marginBottom:10}}>نور</div>
              <div style={{color:"rgba(255,255,150,.6)",fontSize:10,letterSpacing:3,marginBottom:16}}>L'ONDE DE LUMIÈRE</div>
              <div style={{width:110,height:110,borderRadius:"50%",border:"1px solid rgba(255,255,100,.3)",margin:"0 auto 14px",position:"relative",animation:"pulsOrb 1s ease-in-out infinite"}}>
                <div style={{position:"absolute",inset:15,borderRadius:"50%",border:"1px solid rgba(255,255,100,.5)",animation:"pulsOrb 1s ease-in-out infinite .2s"}}/>
                <div style={{position:"absolute",inset:30,borderRadius:"50%",border:"1px solid rgba(255,255,100,.7)",animation:"pulsOrb 1s ease-in-out infinite .4s"}}/>
                <div style={{position:"absolute",inset:45,borderRadius:"50%",background:"rgba(255,255,150,.9)",animation:"pulsOrb 1s ease-in-out infinite .6s"}}/>
              </div>
              <div style={{color:W,fontSize:9,lineHeight:2}}>L'onde se propage vers les 28 lettres.<br/>Le cristal entier s'illumine.</div>
            </div>
          )}
          {kunStep===5&&(
            <div style={{textAlign:"center",animation:"fadeUp .4s ease both"}}>
              <div style={{fontSize:68,color:"white",fontFamily:"Amiri,serif",filter:"drop-shadow(0 0 40px rgba(255,255,255,.9))",marginBottom:14,letterSpacing:4}}>فَيَكُون</div>
              <div style={{color:"rgba(255,255,255,.45)",fontSize:10,letterSpacing:6}}>QUE CELA SOIT</div>
            </div>
          )}
          <button onClick={()=>{clearTimeout(kunTimer.current);setKunStep(0);if(analysis)runOracle(input.trim(),analysis.total,analysis.reduced);}}
            style={{position:"absolute",bottom:24,right:24,background:"none",border:"1px solid "+D,color:D,fontSize:7,letterSpacing:2,padding:"5px 10px",cursor:"pointer",fontFamily:"Cinzel,serif",borderRadius:2}}>
            PASSER ▶
          </button>
        </div>
      )}

      <div style={{position:"relative",zIndex:2,marginTop:16,textAlign:"center"}}>
        <div style={{color:"rgba(232,201,122,.4)",fontSize:10,fontFamily:"Amiri,serif",direction:"rtl",marginBottom:4}}>بِسْمِ اللهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
        <div style={{color:"rgba(232,201,122,.22)",fontSize:7,letterSpacing:3,fontFamily:"Amiri,serif",direction:"rtl"}}>١+٥+٦=١٢→٣ · ٣٠+٤٠+٥٠=١٢٠→٣ · هُوَ · كُن · فَيَكُون</div>
      </div>
    </div>
  );
}
