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
// Phrase de sens — invitation à méditer (pas un jugement)
const ARCH_SENSE={
  1:"Ce mot résonne avec l'Unité — médite le Nom Al-Wâhid, l'Unique.",
  2:"Ce mot résonne avec la Porte — l'ouverture vers ce qui se manifeste.",
  3:"Ce mot résonne avec la Miséricorde — médite le Nom Ar-Rahmân.",
  4:"Ce mot résonne avec la Science — médite le Nom Al-Alîm, le Savant.",
  5:"Ce mot résonne avec le Souffle de Vie — médite le Nom Al-Hayy, le Vivant.",
  6:"Ce mot résonne avec le Lien d'Amour — médite le Nom Al-Wadûd, l'Aimant.",
  7:"Ce mot résonne avec la Perfection — médite la beauté ordonnée des 7 cieux.",
  8:"Ce mot résonne avec l'Équilibre — médite le Nom Al-Adl, le Juste.",
  9:"Ce mot résonne avec la Complétude — la fin du cycle, le retour vers Allah.",
};
const ROOT_L={1:"ا",2:"ب",3:"ج",4:"د",5:"ه",6:"و",7:"ز",8:"ح",9:"ط"};
// Les 9 archétypes — la table de réduction (ilm al-hurûf)
const ARCHETYPES=[
  {n:1,l:"ا",nom:"Alif",arch:"L'Unité",ess:"Le Principe, l'Axe vertical, la Source de tout."},
  {n:2,l:"ب",nom:"Bâ'",arch:"La Porte",ess:"La Manifestation, l'ouverture, la dualité féconde."},
  {n:3,l:"ج",nom:"Jîm",arch:"La Miséricorde",ess:"L'Amour gratuit, la Matrice (R-H-M), la compassion."},
  {n:4,l:"د",nom:"Dâl",arch:"La Science",ess:"La Connaissance, la Preuve, la Porte de la Sagesse."},
  {n:5,l:"ه",nom:"Hâ'",arch:"Le Souffle de Vie",ess:"L'Essence (HU), la vitalité, la Miséricorde pure."},
  {n:6,l:"و",nom:"Wâw",arch:"Le Lien d'Amour",ess:"La Relation, le Crochet, l'union du Ciel et de la Terre."},
  {n:7,l:"ز",nom:"Zây",arch:"La Perfection",ess:"La Création achevée, les 7 cieux, la beauté ordonnée."},
  {n:8,l:"ح",nom:"Hâ'",arch:"L'Équilibre · La Justice",ess:"La Balance, les 8 Porteurs du Trône, l'harmonie."},
  {n:9,l:"ط",nom:"Tâ'",arch:"La Complétude",ess:"La Fin du Cycle, le Retour, l'Adam Cosmique."},
];
// ── MANSIONS LUNAIRES (28 Manazil al-Qamar) ─────────────────
const MANSION_NAMES=[
  "Al-Sharatayn","Al-Butayn","Al-Thurayya","Al-Dabaran",
  "Al-Haqah","Al-Hanah","Al-Dhira","Al-Nathrah",
  "Al-Tarf","Al-Jabhah","Al-Zubrah","Al-Sarfah",
  "Al-Awwa","Al-Simak","Al-Ghafr","Al-Zubanah",
  "Al-Iklil","Al-Qalb","Al-Shawlah","Al-Naim",
  "Al-Baldah","Saad Al-Dhabih","Saad Bula","Saad Al-Suud",
  "Saad Al-Ahbiyah","Al-Fargh Al-Muqaddam","Al-Fargh Al-Muakhkhar","Al-Risha"
];
const MANSION_STARS=[
  "Sheratan (Belier)","Botein (Belier)","Alcyone (Pléiades)","Aldebaran (Taureau)",
  "Meissa (Orion)","Alhena (Gémeaux)","Castor (Gémeaux)","Praesaepe (Cancer)",
  "Alterf (Lion)","Al Jabhah (Lion)","Zosma (Lion)","Denebola (Lion)",
  "Zavijava (Vierge)","Spica (Vierge)","Iota Leonis","Zubenelgenubi (Balance)",
  "Acrab (Scorpion)","Antares (Scorpion)","Shaula (Scorpion)","Phi Sagittarii",
  "Pi Sagittarii","Dabih (Capricorne)","Mu Aquarii","Sadalsuud (Verseau)",
  "Sadachbia (Verseau)","Markab (Pégase)","Scheat (Pégase)","Alpheratz (Andromède)"
];
const MANSION_LETTERS=["a","b","j","d","h","w","z","hh","tt","y","k","l","m","n","s","a","f","ss","q","r","sh","t","th","kh","dh","dd","z","gh"];

function getLunarLongitude(date){
  const J=date.getTime()/86400000+2440587.5;
  const D=J-2451545.0;
  const L=((218.316+13.176396*D)%360+360)%360;
  const M=((134.963+13.064993*D)*Math.PI/180);
  const F=((93.272+13.229350*D)*Math.PI/180);
  const L2=(2*L*Math.PI/180);
  const lon=L+6.289*Math.sin(M)+1.274*Math.sin(L2-M)-0.658*Math.sin(-L2)-0.214*Math.sin(2*M)-0.114*Math.sin(2*F);
  return((lon%360)+360)%360;
}
function getActiveMansion(date=new Date()){
  const lon=getLunarLongitude(date);
  const idx=Math.min(27,Math.floor(lon/(360/28)));
  const LETTERS=["ا","ب","ج","د","ه","و","ز","ح","ط","ي","ك","ل","م","ن","س","ع","ف","ص","ق","ر","ش","ت","ث","خ","ذ","ض","ظ","غ"];
  return{index:idx,letter:LETTERS[idx],name:MANSION_NAMES[idx],star:MANSION_STARS[idx],longitude:parseFloat(lon.toFixed(1))};
}

// Versets coraniques par constellation (sources validées)
const CONSTELLATION_VERSES={
  "RHM":{ ar:"وَرَحْمَتِي وَسِعَتْ كُلَّ شَيْءٍ", fr:"Ma miséricorde embrasse toute chose.", ref:"7:156"},
  "SLM":{ ar:"سَلَامٌ قَوْلًا مِّن رَّبٍّ رَّحِيمٍ", fr:"Paix — parole d'un Seigneur Miséricordieux.", ref:"36:58"},
  "FTH":{ ar:"إِنَّا فَتَحْنَا لَكَ فَتْحًا مُّبِينًا", fr:"Nous t'avons accordé une victoire éclatante.", ref:"48:1"},
  "NWR":{ ar:"اللَّهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ", fr:"Allah est la lumière des cieux et de la terre.", ref:"24:35"},
  "HDY":{ ar:"إِنَّكَ لَا تَهْدِي مَنْ أَحْبَبْتَ وَلَٰكِنَّ اللَّهَ يَهْدِي مَن يَشَاءُ", fr:"Tu ne guides pas qui tu aimes — c'est Allah qui guide.", ref:"28:56"},
  "HQQ":{ ar:"وَقُلْ جَاءَ الْحَقُّ وَزَهَقَ الْبَاطِلُ", fr:"Dis : La Vérité est venue, le faux a disparu.", ref:"17:81"},
  "KRM":{ ar:"إِنَّ أَكْرَمَكُمْ عِندَ اللَّهِ أَتْقَاكُمْ", fr:"Le plus noble d'entre vous est le plus pieux.", ref:"49:13"},
  "SBR":{ ar:"إِنَّ اللَّهَ مَعَ الصَّابِرِينَ", fr:"Allah est avec ceux qui persévèrent.", ref:"2:153"},
  "SHK":{ ar:"لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ", fr:"Si vous êtes reconnaissants, J'augmenterai pour vous.", ref:"14:7"},
  "TWB":{ ar:"إِنَّ اللَّهَ يُحِبُّ التَّوَّابِينَ", fr:"Allah aime ceux qui se repentent.", ref:"2:222"},
  "ILM":{ ar:"وَفَوْقَ كُلِّ ذِي عِلْمٍ عَلِيمٌ", fr:"Au-dessus de tout savant, il y en a un plus savant.", ref:"12:76"},
  "HYT":{ ar:"هُوَ الْحَيُّ لَا إِلَٰهَ إِلَّا هُوَ", fr:"Il est le Vivant — nul dieu sinon Lui.", ref:"40:65"},
  "QDR":{ ar:"إِنَّ اللَّهَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ", fr:"Allah est puissant sur toute chose.", ref:"2:20"},
  "ZHR":{ ar:"سَنُرِيهِمْ آيَاتِنَا فِي الْآفَاقِ", fr:"Nous leur montrerons Nos signes à l'horizon.", ref:"41:53"},
  "SHR":{ ar:"وَمَا يُعَلِّمَانِ مِنْ أَحَدٍ حَتَّىٰ يَقُولَا إِنَّمَا نَحْنُ فِتْنَةٌ", fr:"Ils n'enseignaient à personne sans avertir : nous sommes une épreuve.", ref:"2:102"},
  "ZLM":{ ar:"وَمَن يَظْلِم مِّنكُمْ نُذِقْهُ عَذَابًا كَبِيرًا", fr:"Quiconque est injuste, Nous lui ferons goûter un grand châtiment.", ref:"25:19"},
};

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
// Mots entiers d'abord (priorité max)
const FR2AR_WORDS={
  // Noms / mots fondamentaux
  "allah":"الله","bismillah":"بسم الله","allahou":"الله","hu":"هو","huwa":"هو",
  "salam":"سلام","salaam":"سلام","islam":"إسلام","iman":"إيمان","din":"دين",
  "nour":"نور","nur":"نور","noor":"نور","haq":"حق","haqq":"حق",
  "mahdi":"مهدي","muhammad":"محمد","ahmed":"أحمد","mohammed":"محمد",
  "ibrahim":"إبراهيم","moussa":"موسى","issa":"عيسى","adam":"آدم","nuh":"نوح",
  "quran":"قرآن","coran":"قرآن","sourate":"سورة","ayat":"آية","kun":"كن",
  "barakah":"بركة","baraka":"بركة","tawbah":"توبة","tawba":"توبة",
  "sabr":"صبر","shukr":"شكر","fatiha":"فاتحة","ikhlas":"إخلاص","tawhid":"توحيد",
  "dhikr":"ذكر","dua":"دعاء","sajda":"سجدة","ruku":"ركوع","niyya":"نية",
  "jannah":"جنة","jihad":"جهاد","hijra":"هجرة","sunna":"سنة","fitra":"فطرة",
  // Les 99 Noms divins (translittérations courantes)
  "rahman":"رحمن","rahim":"رحيم","malik":"ملك","quddus":"قدوس",
  "salaam99":"سلام","mumin":"مؤمن","muhaymin":"مهيمن","aziz":"عزيز",
  "jabbar":"جبار","mutakabbir":"متكبر","khaliq":"خالق","bari":"بارئ",
  "musawwir":"مصور","ghaffar":"غفار","qahhar":"قهار","wahhab":"وهاب",
  "razzaq":"رزاق","fattah":"فتاح","alim":"عليم","qabid":"قابض",
  "basit":"باسط","khafid":"خافض","rafi":"رافع","muizz":"معز","muzill":"مذل",
  "sami":"سميع","basir":"بصير","hakam":"حكم","adl":"عدل","latif":"لطيف",
  "khabir":"خبير","halim":"حليم","azim":"عظيم","ghafur":"غفور","shakur":"شكور",
  "ali":"علي","kabir":"كبير","hafiz":"حفيظ","muqit":"مقيت","hasib":"حسيب",
  "jalil":"جليل","karim":"كريم","raqib":"رقيب","mujib":"مجيب","wasi":"واسع",
  "hakim":"حكيم","wadud":"ودود","majid":"مجيد","baith":"باعث","shahid":"شهيد",
  "haqq99":"حق","wakil":"وكيل","qawiyy":"قوي","matin":"متين","waliyy":"ولي",
  "hamid":"حميد","muhsi":"محصي","mubdi":"مبدئ","muid":"معيد","muhyi":"محيي",
  "mumit":"مميت","hayy":"حي","qayyum":"قيوم","wajid":"واجد","majid2":"ماجد",
  "wahid":"واحد","ahad":"أحد","samad":"صمد","qadir":"قادر","muqtadir":"مقتدر",
  "muqaddim":"مقدم","muakhkhir":"مؤخر","awwal":"أول","akhir":"آخر",
  "zahir":"ظاهر","batin":"باطن","wali":"والي","mutaali":"متعالي","barr":"بر",
  "tawwab":"تواب","muntaqim":"منتقم","afuww":"عفو","rauf":"رؤوف",
  "hadi":"هادي","badi":"بديع","baqi":"باقي","warith":"وارث",
  "rashid":"رشيد","sabur":"صبور","ghani":"غني","mughni":"مغني",
  "nafi":"نافع","darr":"ضار","jami":"جامع","muqsit":"مقسط","mani":"مانع",
};
// Set des mots français fiables (pour savoir si la conversion est exacte)
const FR_TRUSTED=new Set(Object.keys(FR2AR_WORDS));
// Digrammes (avant les lettres simples)
const FR2AR_DI=[
  ["dj","ج"],["gh","غ"],["kh","خ"],["sh","ش"],["ch","ش"],
  ["th","ث"],["dh","ذ"],["ou","و"],["au","و"],["ai","ي"],
  ["aa","ا"],["ii","ي"],["uu","و"],
];
// Lettres simples
const FR2AR_SINGLE=[
  ["a","ا"],["â","ا"],["à","ا"],["ä","ا"],
  ["b","ب"],["t","ت"],["j","ج"],
  ["h","ح"],["d","د"],["r","ر"],["z","ز"],["s","س"],
  ["f","ف"],["q","ق"],["k","ك"],["l","ل"],["m","م"],
  ["n","ن"],["w","و"],["y","ي"],["e","ا"],["é","ا"],["è","ا"],["ê","ا"],
  ["i","ي"],["î","ي"],["ï","ي"],["o","و"],["ô","و"],["u","و"],
  ["û","و"],["ù","و"],["g","ج"],["p","ب"],["v","ف"],["'","ع"],["c","ك"],
];
// Le mot français est-il dans le dictionnaire fiable ?
function isFrTrusted(text){
  if(!text) return false;
  if([...text].some(ch=>ABJAD[ch])) return true; // déjà arabe = fiable
  const words=text.toLowerCase().trim().split(/\s+/);
  return words.every(w=>FR_TRUSTED.has(w));
}

function frToAr(text){
  if(!text) return text;
  // Si déjà arabe
  if([...text].some(ch=>ABJAD[ch])) return text;
  const words=text.toLowerCase().trim().split(/\s+/);
  return words.map(word=>{
    // Mot entier connu ?
    if(FR2AR_WORDS[word]) return FR2AR_WORDS[word];
    // Sinon lettre par lettre
    let res=""; let i=0;
    while(i<word.length){
      let matched=false;
      // Digrammes
      for(const [fr,ar] of FR2AR_DI){
        if(word.startsWith(fr,i)){res+=ar;i+=fr.length;matched=true;break;}
      }
      if(!matched){
        // Lettres simples
        for(const [fr,ar] of FR2AR_SINGLE){
          if(word.startsWith(fr,i)){res+=ar;i+=fr.length;matched=true;break;}
        }
      }
      if(!matched) i++;
    }
    return res;
  }).join(" ");
}

// ── SIGNIFICATIONS DES RACINES ──────────────────────────────
// Format: "mot": { fr: "signification", ex: [{ar:"mot arabe", fr:"traduction", voc:"vocabulaire"}] }
const ROOT_DATA={
  "رحم":{fr:"Miséricorde · Matrice",ex:[{ar:"رَحْمَة",fr:"Rahma · Miséricorde"},{ar:"رَحِم",fr:"Rahim · Utérus/Matrice"},{ar:"الرَّحْمَٰن",fr:"Ar-Rahmân · Le Tout Miséricordieux"}]},
  "حرم":{fr:"Sacré · Interdit",ex:[{ar:"حَرَام",fr:"Harâm · Interdit"},{ar:"حَرَم",fr:"Haram · Sanctuaire sacré"},{ar:"مُحَرَّم",fr:"Mouharram · Mois sacré"}]},
  "مرح":{fr:"Joie · Allégresse",ex:[{ar:"مَرَح",fr:"Marah · Joie exubérante"},{ar:"مَرِح",fr:"Marih · Joyeux, enjoué"}]},
  "حمر":{fr:"Rouge · Rougeur",ex:[{ar:"أَحْمَر",fr:"Ahmar · Rouge"},{ar:"حِمَار",fr:"Himâr · Âne"}]},
  "رمح":{fr:"Lance · Javelot",ex:[{ar:"رُمْح",fr:"Roumh · Lance"},{ar:"رَامِح",fr:"Râmih · Lancier"}]},
  "محر":{fr:"Privation",ex:[{ar:"مَحْرُوم",fr:"Mahrûm · Privé, démuni"}]},
  "سلم":{fr:"Paix · Intégrité",ex:[{ar:"سَلَام",fr:"Salâm · Paix"},{ar:"إِسْلَام",fr:"Islâm · Soumission à Allah"},{ar:"مُسْلِم",fr:"Muslim · Musulman"},{ar:"سَلَامَة",fr:"Salâma · Sécurité, salut"}]},
  "لسم":{fr:"Incision légère",ex:[{ar:"لَسَمَ",fr:"Lasama · Piquer légèrement"}]},
  "ملس":{fr:"Lisse · Douceur",ex:[{ar:"أَمْلَس",fr:"Amlas · Lisse, uni"},{ar:"تَمَلَّس",fr:"Tamallas · Glisser"}]},
  "سمل":{fr:"Crever · Vider",ex:[{ar:"سَمَلَ",fr:"Samala · Crever les yeux"}]},
  "لمس":{fr:"Toucher · Contact",ex:[{ar:"لَمَس",fr:"Lamas · Toucher"},{ar:"مُلَامَسَة",fr:"Mulâmasa · Contact physique"}]},
  "مسل":{fr:"Couler · S'écouler",ex:[{ar:"مَسَلَ",fr:"Masala · Couler, s'écouler"}]},
  "نور":{fr:"Lumière divine",ex:[{ar:"نُور",fr:"Nour · Lumière"},{ar:"مُنِير",fr:"Mounir · Lumineux"},{ar:"أَنْوَار",fr:"Anwâr · Lumières"},{ar:"النُّورَيْن",fr:"An-Nûrayn · Les deux lumières"}]},
  "ورن":{fr:"Hésitation · Doute",ex:[{ar:"وَرَن",fr:"Waran · Hésiter, temporiser"}]},
  "رون":{fr:"Lourdeur · Lenteur",ex:[{ar:"رَوَن",fr:"Rawan · Aller lentement"}]},
  "نرو":{fr:"Couler doucement",ex:[{ar:"نَرَا",fr:"Narâ · Couler en filet"}]},
  "ونر":{fr:"Soupir · Plainte",ex:[{ar:"وَنَرَ",fr:"Wanara · Gémir"}]},
  "رنو":{fr:"Regarder fixement",ex:[{ar:"رَنَا",fr:"Ranâ · Regarder fixement avec désir"}]},
  "فتح":{fr:"Ouverture · Victoire",ex:[{ar:"فَتْح",fr:"Fath · Victoire, ouverture"},{ar:"مِفْتَاح",fr:"Miftâh · Clé"},{ar:"الفَاتِحَة",fr:"Al-Fâtiha · Celle qui ouvre"}]},
  "حفت":{fr:"Bord · Côté",ex:[{ar:"حَافَة",fr:"Hâfa · Bord, lisière"}]},
  "تفح":{fr:"Pomme · Fruit",ex:[{ar:"تُفَّاح",fr:"Touffâh · Pomme"},{ar:"تُفَّاحَة",fr:"Touffâha · Une pomme"}]},
  "فحت":{fr:"Charbon · Noirceur",ex:[{ar:"فَحْم",fr:"Fahm · Charbon"}]},
  "تحف":{fr:"Cadeau précieux",ex:[{ar:"تُحْفَة",fr:"Touhfa · Cadeau précieux, joyau"}]},
  "حتف":{fr:"Destin fatal",ex:[{ar:"حَتْف",fr:"Hatf · Mort, destin fatal"}]},
  "علم":{fr:"Science · Savoir",ex:[{ar:"عِلْم",fr:"Ilm · Science, connaissance"},{ar:"عَالِم",fr:"Âlim · Savant"},{ar:"قَلَم",fr:"Qalam · Plume, stylo"},{ar:"مَعْلُوم",fr:"Maloûm · Connu, su"}]},
  "لمع":{fr:"Briller · Éclat",ex:[{ar:"لَمَعَ",fr:"Lamaa · Briller"},{ar:"لَمَعَان",fr:"Lama'ân · Scintillement"}]},
  "معل":{fr:"Hauteur · Élévation",ex:[{ar:"مَعَالٍ",fr:"Maâlî · Hauteurs, grandeurs"}]},
  "عمل":{fr:"Travail · Action",ex:[{ar:"عَمَل",fr:"Amal · Travail, action"},{ar:"عَامِل",fr:"Âmil · Travailleur"},{ar:"أَعْمَال",fr:"Amâl · Œuvres"}]},
  "ملع":{fr:"Maudit · Répudié",ex:[{ar:"مَلْعُون",fr:"Maloun · Maudit"}]},
  "لعم":{fr:"Affirmer · Jurer",ex:[{ar:"لَعَمْرُكَ",fr:"Laâmruka · Par ta vie ! (serment)"}]},
  "قلب":{fr:"Cœur · Retournement",ex:[{ar:"قَلْب",fr:"Qalb · Cœur"},{ar:"انْقِلَاب",fr:"Inqilâb · Révolution, renversement"},{ar:"قَلَّبَ",fr:"Qallaba · Retourner"}]},
  "حمد":{fr:"Louange · Gratitude",ex:[{ar:"حَمْد",fr:"Hamd · Louange"},{ar:"أَحْمَد",fr:"Ahmad · Le plus loué (Prophète ﷺ)"},{ar:"مُحَمَّد",fr:"Muhammad · Loué (Prophète ﷺ)"},{ar:"الحَمْدُ لِلّٰه",fr:"Al-Hamdulillah · Louange à Allah"}]},
  "ليس":{fr:"Négation · Il n'est pas",ex:[{ar:"لَيْسَ",fr:"Laysa · Il n'est pas, non"},{ar:"لَيْث",fr:"Layth · Lion courageux"}]},
  "يسل":{fr:"Glisser · Sortir",ex:[{ar:"يَسَلَ",fr:"Yasala · Sortir doucement"}]},
  "سلي":{fr:"Consoler · Distraire",ex:[{ar:"سَلَّى",fr:"Sallâ · Consoler, distraire"},{ar:"تَسْلِيَة",fr:"Tasliya · Distraction, consolation"}]},
  "يلس":{fr:"Être sans courage",ex:[{ar:"يَلِسَ",fr:"Yalisa · Manquer de courage"}]},
  "لسي":{fr:"Avaler · Ingérer",ex:[{ar:"لَسَا",fr:"Lasâ · Avaler"}]},
  "سيل":{fr:"Courant · Flot",ex:[{ar:"سَيْل",fr:"Sayl · Torrent, flot"},{ar:"سَيَلَان",fr:"Sayalân · Écoulement"}]},

  // ── RACINES CORANIQUES ESSENTIELLES ──────────────────────
  "أمن":{fr:"Croire · Foi · Sécurité",ex:[{ar:"إِيمَان",fr:"Îmân · La Foi"},{ar:"مُؤْمِن",fr:"Moumin · Croyant"},{ar:"أَمَان",fr:"Amân · Sécurité"},{ar:"أَمِين",fr:"Amîn · Fidèle, digne de confiance"}]},
  "نمأ":{fr:"Croître en foi",ex:[{ar:"نَمَاء",fr:"Namâ · Croissance"}]},
  "منأ":{fr:"Empêcher · Retenir",ex:[{ar:"مَنَعَ",fr:"Mana'a · Empêcher"}]},
  "أنم":{fr:"Humanité · Créatures",ex:[{ar:"أَنَام",fr:"Anâm · Les créatures d'Allah (Coran 55:10)"}]},

  "قرأ":{fr:"Lire · Réciter",ex:[{ar:"قُرْآن",fr:"Qour'ân · Le Coran (la Récitation)"},{ar:"اقْرَأ",fr:"Iqra' · Lis ! (1er verset révélé — 96:1)"},{ar:"قِرَاءَة",fr:"Qirâ'a · Récitation, lecture"}]},
  "رأق":{fr:"Profondeur limpide",ex:[{ar:"رَاقَ",fr:"Râqa · Être limpide, pur"}]},
  "أرق":{fr:"Insomnie · Inquiétude",ex:[{ar:"أَرَق",fr:"Araq · Insomnie"}]},

  "هدي":{fr:"Guidance · Chemin droit",ex:[{ar:"هُدَى",fr:"Hudâ · La guidance divine"},{ar:"هَادِي",fr:"Hâdî · Le Guide (Nom divin)"},{ar:"هِدَايَة",fr:"Hidâya · Guidance, direction"},{ar:"اهْتَدَى",fr:"Ihtadâ · Trouver le droit chemin"}]},
  "ديه":{fr:"Compensation · Prix du sang",ex:[{ar:"دِيَة",fr:"Diya · Compensation légale"}]},
  "يده":{fr:"Main · Puissance",ex:[{ar:"يَد",fr:"Yad · Main, pouvoir"}]},

  "نصر":{fr:"Soutenir · Victoire divine",ex:[{ar:"نَصَرَ",fr:"Nasara · Soutenir, aider"},{ar:"نَصْر",fr:"Nasr · Victoire"},{ar:"النَّاصِر",fr:"An-Nâsir · Celui qui soutient"},{ar:"أَنْصَار",fr:"Ansâr · Les Compagnons Médinois"}]},
  "رنص":{fr:"Bruit de feuillage",ex:[{ar:"رَنَصَ",fr:"Ranasa · Bruire (feuilles)"}]},
  "صنر":{fr:"Agripper",ex:[{ar:"صَنَرَ",fr:"Sanara · Agripper fermement"}]},

  "حيي":{fr:"Vivre · Vie · Vivifier",ex:[{ar:"حَيَاة",fr:"Hayât · La Vie"},{ar:"الحَيّ",fr:"Al-Hayy · Le Vivant (Nom divin)"},{ar:"حَيَّ عَلَى الصَّلَاة",fr:"Hayya alas-salâh · Venez à la prière (appel)"}]},
  "يحي":{fr:"Il vivifie",ex:[{ar:"يُحْيِي",fr:"Yuhyî · Il donne la vie (Coran 2:258)"},{ar:"يَحْيَى",fr:"Yahyâ · Jean (prophète AS)"}]},

  "موت":{fr:"Mourir · Mort",ex:[{ar:"مَوْت",fr:"Mawt · La mort"},{ar:"المُمِيت",fr:"Al-Mumît · Celui qui fait mourir (Nom divin)"},{ar:"مَيِّت",fr:"Mayyit · Mort"}]},
  "وتم":{fr:"Achèvement complet",ex:[{ar:"وَتَمَ",fr:"Watama · Compléter entièrement"}]},
  "تمو":{fr:"Achèvement · Mûrir",ex:[{ar:"تَمَّ",fr:"Tamma · S'accomplir, se compléter"}]},

  "أمر":{fr:"Commander · Ordonner",ex:[{ar:"أَمَرَ",fr:"Amara · Ordonner"},{ar:"أَمْر",fr:"Amr · Ordre, affaire"},{ar:"أَمِير",fr:"Amîr · Prince, commandant"},{ar:"مَأْمُور",fr:"Ma'mour · Chargé d'une mission"}]},
  "رمأ":{fr:"Se tapir · S'abriter",ex:[{ar:"رَمَأَ",fr:"Rama'a · Se tapir, se cacher"}]},
  "مرأ":{fr:"Femme · Miroir",ex:[{ar:"امْرَأَة",fr:"Imra'a · Femme"},{ar:"مِرْآة",fr:"Mir'ât · Miroir"}]},

  "نهي":{fr:"Interdire · Raison",ex:[{ar:"نَهَى",fr:"Nahâ · Interdire"},{ar:"نَهْي",fr:"Nahy · Interdiction"},{ar:"أُولِي النُّهَى",fr:"Ouli-n-Nuhâ · Les hommes de raison (Coran 20:54)"}]},
  "يهن":{fr:"Humilier · Affaiblir",ex:[{ar:"يَهِين",fr:"Yahîn · Il humilie"}]},
  "هني":{fr:"Bonheur · Douceur",ex:[{ar:"هَنِيء",fr:"Hanî · Agréable, savoureux"},{ar:"تَهْنِئَة",fr:"Tahni'a · Félicitation"}]},

  "وحي":{fr:"Révélation divine",ex:[{ar:"وَحْي",fr:"Wahy · La Révélation d'Allah"},{ar:"أَوْحَى",fr:"Awha · Il révéla (Coran 53:10)"},{ar:"مُوحًى",fr:"Mouhâ · Révélé par Allah"}]},
  "حيو":{fr:"Vie · Salutation",ex:[{ar:"تَحِيَّة",fr:"Tahiyya · Salutation"},{ar:"حَيَّا",fr:"Hayya · Saluer"}]},
  "يوح":{fr:"Inspirer · Souffler",ex:[{ar:"يُوحِي",fr:"Youhi · Il inspire, il révèle"}]},

  "أيد":{fr:"Aider · Renforcer",ex:[{ar:"أَيَّدَ",fr:"Ayyada · Renforcer, soutenir"},{ar:"تَأْيِيد",fr:"Ta'yîd · Soutien, renforcement"},{ar:"أَيَّدْنَاهُ",fr:"Ayyadnâhu · Nous l'avons soutenu (Coran 2:87)"}]},
  "داي":{fr:"Maladie · Remède",ex:[{ar:"دَاء",fr:"Dâ' · Maladie, vice"},{ar:"دَوَاء",fr:"Dawâ' · Remède, médicament"}]},
  "يدأ":{fr:"Calme · Apaisement",ex:[{ar:"يَدَأَ",fr:"Yada'a · S'apaiser"}]},

  "صبر":{fr:"Patience · Persévérance",ex:[{ar:"صَبَرَ",fr:"Sabara · Patienter"},{ar:"صَبْر",fr:"Sabr · La patience"},{ar:"الصَّبُور",fr:"As-Sabour · Le Très Patient (Nom divin)"},{ar:"اصْبِرُوا",fr:"Isbirû · Soyez patients (Coran 3:200)"}]},
  "برص":{fr:"Lèpre · Blancheur",ex:[{ar:"بَرَص",fr:"Baras · Lèpre (Coran 3:49)"},{ar:"أَبْرَص",fr:"Abras · Lépreux"}]},
  "رصب":{fr:"Fermeté · Dureté",ex:[{ar:"رَصَبَ",fr:"Rasaba · Être dur, ferme"}]},

  "تقو":{fr:"Piété · Crainte révérencielle",ex:[{ar:"تَقْوَى",fr:"Taqwâ · La piété, la crainte d'Allah"},{ar:"تَقِيّ",fr:"Taqî · Pieux"},{ar:"المُتَّقِين",fr:"Al-Muttaqîn · Les pieux (Coran 2:2)"},{ar:"اتَّقَى",fr:"Ittaqâ · Craindre Allah, être pieux"}]},
  "وتق":{fr:"Confiance · Pacte",ex:[{ar:"وَثِق",fr:"Wathiqa · Faire confiance"},{ar:"وَثِيقَة",fr:"Wathîqa · Document, pacte"}]},
  "قوت":{fr:"Nourriture · Subsistance",ex:[{ar:"قُوت",fr:"Qout · Nourriture de base, subsistance"}]},

  // ── A-B-K (documenté classiquement) ──
  "كأب":{fr:"Tristesse · Abattement",ex:[{ar:"كَآبَة",fr:"Ka'âba · Mélancolie (Lisân al-Arab)"},{ar:"مَكْؤُوب",fr:"Mak'oub · Attristé, abattu"}]},
  "أكب":{fr:"Se pencher · Se consacrer",ex:[{ar:"أَكَبَّ",fr:"Akabba · Se pencher sur (Coran 67:22)"},{ar:"مُنْكَبّ",fr:"Monkabb · Penché en avant"}]},

  // ── VOCABULAIRE CORANIQUE COMPLET ──
"أمن":{fr:"Foi · Sécurité",ex:[{ar:"أَمَن",fr:"Amana · Croire, être en sécurité"},{ar:"إِيمَان",fr:"Îmân · Foi"},{ar:"أَمِين",fr:"Amîn · Fidèle, digne de confiance"},{ar:"مُؤْمِن",fr:"Moumin · Croyant"}]},
  "نما":{fr:"Croissance · Développement",ex:[{ar:"نَمَا",fr:"Namâ · Croître"},{ar:"نَمَاء",fr:"Namâ' · Croissance, développement"}]},
  "منا":{fr:"Destin · Mort",ex:[{ar:"مَنَى",fr:"Manâ · Le destin"},{ar:"مَنِيَّة",fr:"Maniyya · La mort"}]},
  "امن":{fr:"Paix · Sécurité",ex:[{ar:"أَمَان",fr:"Amân · Sécurité, protection"},{ar:"آمَنَ",fr:"Âmana · Croire, se sentir en sécurité"}]},
  "بدأ":{fr:"Commencement · Début",ex:[{ar:"بَدَأَ",fr:"Bada'a · Commencer"},{ar:"ابْتِدَاء",fr:"Ibtidâ' · Début, commencement"}]},
  "برك":{fr:"Bénédiction",ex:[{ar:"بَرَكَة",fr:"Baraka · Bénédiction"},{ar:"تَبَارَكَ",fr:"Tabâraka · Béni soit (Coran 67:1)"},{ar:"مُبَارَك",fr:"Mubârak · Béni"}]},
  "بصر":{fr:"Vue · Clairvoyance",ex:[{ar:"بَصَر",fr:"Basar · Vue"},{ar:"بَصِير",fr:"Basîr · Clairvoyant"},{ar:"البَصِير",fr:"Al-Basîr · Celui qui voit tout (Nom divin)"}]},
  "بعث":{fr:"Résurrection · Envoi",ex:[{ar:"بَعَثَ",fr:"Ba'atha · Ressusciter, envoyer"},{ar:"بَعْث",fr:"Ba'th · Résurrection"},{ar:"الباعث",fr:"Al-Bâ'ith · Le Ressusciteur"}]},
  "بلغ":{fr:"Atteindre · Communiquer",ex:[{ar:"بَلَغَ",fr:"Balagha · Atteindre"},{ar:"بَلَاغ",fr:"Balâgh · Communication, message"},{ar:"تَبْلِيغ",fr:"Tablîgh · Propagation du message"}]},
  "بنى":{fr:"Construction · Bâtir",ex:[{ar:"بَنَى",fr:"Banâ · Construire"},{ar:"بِنَاء",fr:"Binâ' · Construction"},{ar:"ابن",fr:"Ibn · Fils"}]},
  "بهج":{fr:"Joie · Splendeur",ex:[{ar:"بَهْجَة",fr:"Bahja · Joie, splendeur"},{ar:"بَهِيج",fr:"Bahîj · Splendide, radieux"}]},
  "تبع":{fr:"Suivre · Obéir",ex:[{ar:"تَبِعَ",fr:"Tabi'a · Suivre"},{ar:"تَابِع",fr:"Tâbi' · Suiveur, disciple"},{ar:"اتَّبَعَ",fr:"Ittaba'a · Suivre (Coran)"}]},
  "تقى":{fr:"Piété · Crainte de Dieu",ex:[{ar:"تَقْوَى",fr:"Taqwâ · Piété, crainte d'Allah"},{ar:"تَقِيّ",fr:"Taqî · Pieux"},{ar:"المُتَّقِين",fr:"Al-Muttaqîn · Les pieux (Coran 2:2)"}]},
  "توب":{fr:"Repentir · Retour",ex:[{ar:"تَابَ",fr:"Tâba · Se repentir"},{ar:"تَوْبَة",fr:"Tawba · Repentir"},{ar:"التَّوَّاب",fr:"At-Tawwâb · Celui qui accepte le repentir"}]},
  "ثقل":{fr:"Lourdeur · Poids",ex:[{ar:"ثَقَل",fr:"Thaqal · Lourdeur, fardeau"},{ar:"ثَقِيل",fr:"Thaqîl · Lourd"},{ar:"مَثَاقِيل",fr:"Mathâqîl · Poids (Coran 21:47)"}]},
  "ثمر":{fr:"Fruit · Résultat",ex:[{ar:"ثَمَر",fr:"Thamar · Fruit"},{ar:"ثَمَرَة",fr:"Thamara · Un fruit"},{ar:"أَثْمَر",fr:"Athmara · Porter ses fruits"}]},
  "جمع":{fr:"Rassemblement · Réunion",ex:[{ar:"جَمَعَ",fr:"Jama'a · Rassembler"},{ar:"جَمَاعَة",fr:"Jamâ'a · Communauté"},{ar:"الجَامِع",fr:"Al-Jâmi' · Le Rassembleur"}]},
  "جهد":{fr:"Effort · Jihad",ex:[{ar:"جَهَدَ",fr:"Jahada · Faire un effort"},{ar:"جِهَاد",fr:"Jihâd · Effort sur la voie d'Allah"},{ar:"اجْتِهَاد",fr:"Ijtihâd · Effort de réflexion"}]},
  "جهل":{fr:"Ignorance",ex:[{ar:"جَهِلَ",fr:"Jahila · Ignorer"},{ar:"جَهْل",fr:"Jahl · Ignorance"},{ar:"جَاهِل",fr:"Jâhil · Ignorant"}]},
  "جود":{fr:"Générosité · Pluie",ex:[{ar:"جَوَاد",fr:"Jawâd · Généreux"},{ar:"جُود",fr:"Joud · Générosité"},{ar:"أَجَادَ",fr:"Ajâda · Bien faire"}]},
  "هدى":{fr:"Guidance · Chemin droit",ex:[{ar:"هُدَى",fr:"Houdâ · Guidance"},{ar:"هَدَى",fr:"Hadâ · Guider"},{ar:"الهَادِي",fr:"Al-Hâdî · Le Guide"},{ar:"اهْتَدَى",fr:"Ihtadâ · Trouver le bon chemin"}]},
  "هلل":{fr:"Louange · Croissant",ex:[{ar:"هَلَّلَ",fr:"Hallala · Dire 'La ilaha illallah'"},{ar:"هِلَال",fr:"Hilâl · Croissant de lune"},{ar:"تَهْلِيل",fr:"Tahlîl · La ilaha illallah"}]},
  "همم":{fr:"Résolution · Ambition",ex:[{ar:"هِمَّة",fr:"Himma · Ambition, détermination"},{ar:"هَمَّ",fr:"Hamma · Se résoudre à"}]},
  "خلق":{fr:"Création · Caractère",ex:[{ar:"خَلَقَ",fr:"Khalaqa · Créer"},{ar:"خَالِق",fr:"Khâliq · Créateur"},{ar:"الخَالِق",fr:"Al-Khâliq · Le Créateur (Nom divin)"},{ar:"خُلُق",fr:"Khoulouq · Caractère, morale"}]},
  "خشع":{fr:"Humilité · Recueillement",ex:[{ar:"خَشَعَ",fr:"Khasha'a · S'humilier"},{ar:"خُشُوع",fr:"Khoushou' · Recueillement (dans la prière)"},{ar:"خَاشِع",fr:"Khâshi' · Recueilli, humble"}]},
  "خشي":{fr:"Crainte · Révérence",ex:[{ar:"خَشِيَ",fr:"Khashiya · Craindre"},{ar:"خَشْيَة",fr:"Khashya · Crainte révérencielle"},{ar:"يَخْشَى",fr:"Yakhshâ · Il craint (Coran)"}]},
  "خبر":{fr:"Information · Connaissance",ex:[{ar:"خَبَرَ",fr:"Khabara · Informer"},{ar:"خَبَر",fr:"Khabar · Nouvelle, information"},{ar:"الخَبِير",fr:"Al-Khabîr · Le Parfaitement Informé"}]},
  "دعو":{fr:"Appel · Invocation · Prière",ex:[{ar:"دَعَا",fr:"Da'â · Appeler, invoquer"},{ar:"دُعَاء",fr:"Dou'â · Invocation, prière"},{ar:"دَاعِية",fr:"Dâ'iya · Prédicateur"}]},
  "دخل":{fr:"Entrée · Pénétrer",ex:[{ar:"دَخَلَ",fr:"Dakhala · Entrer"},{ar:"مَدْخَل",fr:"Madkhal · Entrée"},{ar:"دَاخِل",fr:"Dâkhil · Intérieur"}]},
  "دين":{fr:"Religion · Jugement · Dette",ex:[{ar:"دِين",fr:"Dîn · Religion, mode de vie"},{ar:"يَوْم الدِّين",fr:"Yawm ad-Dîn · Jour du Jugement"},{ar:"دَيَّان",fr:"Dayyân · Juge souverain"}]},
  "ذهب":{fr:"Or · Partir",ex:[{ar:"ذَهَب",fr:"Dhahab · Or"},{ar:"ذَهَبَ",fr:"Dhahaba · Partir, s'en aller"}]},
  "ذنب":{fr:"Péché · Faute",ex:[{ar:"ذَنْب",fr:"Dhanb · Péché, faute"},{ar:"ذُنُوب",fr:"Dhounoub · Péchés"},{ar:"مُذْنِب",fr:"Moudhnib · Pécheur"}]},
  "رزق":{fr:"Subsistance · Don d'Allah",ex:[{ar:"رِزْق",fr:"Rizq · Subsistance, don d'Allah"},{ar:"الرَّزَّاق",fr:"Ar-Razzâq · Le Pourvoyeur"},{ar:"رَزَقَ",fr:"Razaqa · Pourvoir en subsistance"}]},
  "رسل":{fr:"Envoi · Message",ex:[{ar:"رَسُول",fr:"Rasoul · Messager"},{ar:"رِسَالَة",fr:"Risâla · Message, mission"},{ar:"أَرْسَلَ",fr:"Arsala · Envoyer"}]},
  "رضي":{fr:"Satisfaction · Agrément",ex:[{ar:"رَضِيَ",fr:"Radiya · Être satisfait"},{ar:"رِضَا",fr:"Ridâ · Agrément d'Allah"},{ar:"مَرْضِيّ",fr:"Mardî · Agréé"}]},
  "رقب":{fr:"Surveillance · Vigilance",ex:[{ar:"رَقَبَ",fr:"Raqaba · Surveiller"},{ar:"الرَّقِيب",fr:"Ar-Raqîb · Le Vigilant (Nom divin)"},{ar:"مُرَاقَبَة",fr:"Mourâqaba · Vigilance spirituelle"}]},
  "روح":{fr:"Âme · Esprit · Souffle",ex:[{ar:"رُوح",fr:"Rouah · Âme, esprit"},{ar:"رَوْح",fr:"Rawh · Souffle, répit"},{ar:"رُوح القُدُس",fr:"Rouah al-Qoudous · Saint Esprit"}]},
  "زكو":{fr:"Pureté · Aumône légale",ex:[{ar:"زَكَاة",fr:"Zakât · Aumône légale"},{ar:"زَكَى",fr:"Zakâ · Être pur"},{ar:"تَزْكِيَة",fr:"Tazkiya · Purification de l'âme"}]},
  "زهد":{fr:"Ascèse · Détachement",ex:[{ar:"زَهَدَ",fr:"Zahada · Se détacher du monde"},{ar:"زُهْد",fr:"Zuhd · Ascèse, détachement"},{ar:"زَاهِد",fr:"Zâhid · Ascète"}]},
  "سجد":{fr:"Prosternation",ex:[{ar:"سَجَدَ",fr:"Sajada · Se prosterner"},{ar:"سُجُود",fr:"Soujoûd · Prosternation"},{ar:"مَسْجِد",fr:"Masjid · Mosquée"}]},
  "سمع":{fr:"Ouïe · Écouter",ex:[{ar:"سَمِعَ",fr:"Sami'a · Entendre"},{ar:"سَمْع",fr:"Sam' · Ouïe"},{ar:"السَّمِيع",fr:"As-Samî' · Celui qui entend tout"}]},
  "سور":{fr:"Mur · Sourate",ex:[{ar:"سُورَة",fr:"Soûra · Sourate du Coran"},{ar:"سُور",fr:"Sour · Mur d'enceinte"},{ar:"سُوَر",fr:"Souwar · Sourates"}]},
  "شهد":{fr:"Témoignage · Présence",ex:[{ar:"شَهِدَ",fr:"Shahida · Témoigner"},{ar:"شَهَادَة",fr:"Shahâda · Témoignage, la Shahâda"},{ar:"الشَّهِيد",fr:"Ash-Shahîd · Le Témoin (Nom divin)"}]},
  "شكر":{fr:"Gratitude · Remerciement",ex:[{ar:"شَكَرَ",fr:"Shakara · Remercier"},{ar:"شُكْر",fr:"Shukr · Gratitude"},{ar:"الشَّكُور",fr:"Ash-Shakour · Le Reconnaissant (Nom divin)"}]},
  "شرح":{fr:"Expansion · Explication",ex:[{ar:"شَرَحَ",fr:"Sharaha · Expliquer, ouvrir"},{ar:"شَرْح",fr:"Sharh · Explication"},{ar:"انْشِرَاح",fr:"Inshirâh · Expansion du cœur (Coran 94:1)"}]},
  "صدق":{fr:"Vérité · Sincérité",ex:[{ar:"صَدَقَ",fr:"Sadaqa · Dire la vérité"},{ar:"صِدْق",fr:"Sidq · Sincérité"},{ar:"صَدَقَة",fr:"Sadaqa · Aumône volontaire"},{ar:"صَادِق",fr:"Sâdiq · Sincère, véridique"}]},
  "صلح":{fr:"Réforme · Correction",ex:[{ar:"صَلَحَ",fr:"Salaha · Être bon, se corriger"},{ar:"إِصْلَاح",fr:"Islâh · Réforme"},{ar:"صَالِح",fr:"Sâlih · Vertueux, bon"}]},
  "صلو":{fr:"Prière · Bénédiction",ex:[{ar:"صَلَاة",fr:"Salât · Prière rituelle"},{ar:"صَلَّى",fr:"Sallâ · Prier"},{ar:"صَلَوَات",fr:"Salawât · Bénédictions sur le Prophète ﷺ"}]},
  "صبح":{fr:"Matin · Aube",ex:[{ar:"صَبَاح",fr:"Sabâh · Matin"},{ar:"الصُّبح",fr:"As-Soubh · L'aube"},{ar:"أَصْبَحَ",fr:"Asbaha · Devenir le matin"}]},
  "ضرب":{fr:"Frapper · Voyager · Exemple",ex:[{ar:"ضَرَبَ",fr:"Daraba · Frapper, voyager"},{ar:"ضَرْب",fr:"Darb · Coup"},{ar:"مَضْرَب",fr:"Madraba · Exemple, parabole"}]},
  "طهر":{fr:"Pureté · Purification",ex:[{ar:"طَهَرَ",fr:"Tahara · Être pur"},{ar:"طَهَارَة",fr:"Tahâra · Pureté rituelle"},{ar:"طَاهِر",fr:"Tâhir · Pur"}]},
  "طلب":{fr:"Demande · Recherche",ex:[{ar:"طَلَبَ",fr:"Talaba · Demander, chercher"},{ar:"طَلَب",fr:"Talab · Demande"},{ar:"طَالِب",fr:"Tâlib · Étudiant, demandeur"}]},
  "ظلم":{fr:"Injustice · Ténèbres",ex:[{ar:"ظَلَمَ",fr:"Zalama · Être injuste"},{ar:"ظُلْم",fr:"Zoulm · Injustice"},{ar:"ظُلُمَات",fr:"Zouloumât · Ténèbres (Coran 2:17)"},{ar:"ظَالِم",fr:"Zâlim · Injuste, oppresseur"}]},
  "عبد":{fr:"Adoration · Servitude",ex:[{ar:"عَبَدَ",fr:"Abada · Adorer"},{ar:"عِبَادَة",fr:"Ibâda · Adoration"},{ar:"عَبْد",fr:"Abd · Serviteur (d'Allah)"},{ar:"عُبُودِيَّة",fr:"Ouboûdiyya · Servitude divine"}]},
  "عقل":{fr:"Raison · Intellect",ex:[{ar:"عَقَلَ",fr:"Aqala · Comprendre, raisonner"},{ar:"عَقْل",fr:"Aql · Raison, intellect"},{ar:"عَاقِل",fr:"Âqil · Raisonnable"}]},
  "علو":{fr:"Hauteur · Élévation",ex:[{ar:"عَلَا",fr:"Alâ · S'élever"},{ar:"عُلُوّ",fr:"Oulou' · Élévation"},{ar:"العَلِيّ",fr:"Al-Alî · Le Très Haut (Nom divin)"},{ar:"عُلَمَاء",fr:"Oulamâ · Savants"}]},
  "عمر":{fr:"Vie · Prospérité",ex:[{ar:"عَمَرَ",fr:"Amara · Vivre, prospérer"},{ar:"عُمْر",fr:"Oumr · Vie, âge"},{ar:"عِمَارَة",fr:"Imâra · Construction, civilisation"}]},
  "غفر":{fr:"Pardon · Absolution",ex:[{ar:"غَفَرَ",fr:"Ghafara · Pardonner"},{ar:"مَغْفِرَة",fr:"Maghfira · Pardon"},{ar:"الغَفُور",fr:"Al-Ghafour · Le Très Pardonneur"},{ar:"الغَفَّار",fr:"Al-Ghaffâr · Le Grand Pardonneur"}]},
  "غيب":{fr:"Invisible · Mystère",ex:[{ar:"غَيْب",fr:"Ghayb · L'invisible, le mystère"},{ar:"عَالِم الغَيْب",fr:"Âlim al-Ghayb · Connaisseur de l'invisible"},{ar:"غَائِب",fr:"Ghâ'ib · Absent, invisible"}]},
  "فكر":{fr:"Pensée · Réflexion",ex:[{ar:"فَكَّرَ",fr:"Fakkara · Réfléchir"},{ar:"فِكْر",fr:"Fikr · Pensée, réflexion"},{ar:"تَفَكُّر",fr:"Tafakour · Méditation (Coran 3:191)"}]},
  "فهم":{fr:"Compréhension",ex:[{ar:"فَهِمَ",fr:"Fahima · Comprendre"},{ar:"فَهْم",fr:"Fahm · Compréhension"},{ar:"فَهِيم",fr:"Fahîm · Compréhensif"}]},
  "فوز":{fr:"Succès · Réussite",ex:[{ar:"فَازَ",fr:"Fâza · Réussir, triompher"},{ar:"فَوْز",fr:"Fawz · Succès, victoire"},{ar:"الفَائِز",fr:"Al-Fâ'iz · Le victorieux"}]},
  "قدر":{fr:"Puissance · Destin",ex:[{ar:"قَدَرَ",fr:"Qadara · Pouvoir"},{ar:"قَدَر",fr:"Qadar · Destin d'Allah"},{ar:"القَدِير",fr:"Al-Qadîr · Le Capable"},{ar:"لَيْلَة القَدْر",fr:"Laylat al-Qadr · La nuit du Destin"}]},
  "قرأ":{fr:"Lecture · Récitation",ex:[{ar:"قَرَأَ",fr:"Qara'a · Lire, réciter"},{ar:"قُرْآن",fr:"Qour'ân · Le Coran (la Récitation)"},{ar:"اقْرَأ",fr:"Iqra' · Lis ! (1er verset révélé)"}]},
  "قيم":{fr:"Valeurs · Droiture",ex:[{ar:"قَيِّم",fr:"Qayyim · Droit, juste"},{ar:"القَيُّوم",fr:"Al-Qayyoûm · Le Subsistant"},{ar:"قِيَام",fr:"Qiyâm · Résurrection, debout"}]},
  "كفر":{fr:"Voilement · Ingratitude",ex:[{ar:"كَفَرَ",fr:"Kafara · Être ingrat, rejeter la foi"},{ar:"كُفْر",fr:"Koufr · Mécréance"},{ar:"كَافِر",fr:"Kâfir · Mécréant, ingrat"}]},
  "كلم":{fr:"Parole · Blessure",ex:[{ar:"كَلَّمَ",fr:"Kallama · Parler à"},{ar:"كَلَام",fr:"Kalâm · Parole, discours"},{ar:"كَلِمَة",fr:"Kalima · Mot, parole"},{ar:"كَلِمَة الله",fr:"Kalimat Allah · La Parole d'Allah"}]},
  "كون":{fr:"Être · Existence",ex:[{ar:"كَانَ",fr:"Kâna · Être, exister"},{ar:"كُن",fr:"Koun · Sois ! (ordre divin)"},{ar:"كَوْن",fr:"Kawn · Univers, existence"},{ar:"تَكْوِين",fr:"Takwîn · Création, Genèse"}]},
  "لطف":{fr:"Subtilité · Bienveillance",ex:[{ar:"لَطِيف",fr:"Latîf · Subtil, bienveillant"},{ar:"اللَّطِيف",fr:"Al-Latîf · Le Subtil (Nom divin)"},{ar:"لُطْف",fr:"Loutf · Bonté, délicatesse"}]},
  "لقي":{fr:"Rencontre · Retour à Allah",ex:[{ar:"لَقِيَ",fr:"Laqiya · Rencontrer"},{ar:"لِقَاء",fr:"Liqâ' · Rencontre"},{ar:"لِقَاء الله",fr:"Liqâ' Allah · La rencontre avec Allah"}]},
  "ملك":{fr:"Royauté · Possession",ex:[{ar:"مَلَكَ",fr:"Malaka · Posséder"},{ar:"مَلِك",fr:"Malik · Roi"},{ar:"المَلِك",fr:"Al-Malik · Le Roi Absolu"},{ar:"مَلَكُوت",fr:"Malakout · Royaume céleste"}]},
  "مسح":{fr:"Toucher · Essuyer",ex:[{ar:"مَسَحَ",fr:"Masaha · Toucher, essuyer"},{ar:"مَسِيح",fr:"Masîh · Messie (Jésus/Aïssa AS)"},{ar:"مِسَاحَة",fr:"Misâha · Surface, espace"}]},
  "نبو":{fr:"Prophétie · Élévation",ex:[{ar:"نَبِيّ",fr:"Nabî · Prophète"},{ar:"نُبُوَّة",fr:"Nouboûwwa · Prophétie"},{ar:"أَنْبِيَاء",fr:"Anbiyâ' · Prophètes"}]},
  "نفس":{fr:"Âme · Souffle · Soi",ex:[{ar:"نَفْس",fr:"Nafs · Âme, soi"},{ar:"نَفَسَ",fr:"Nafasa · Souffler"},{ar:"أَنْفَاس",fr:"Anfâs · Souffles, respirations"}]},
  "نهر":{fr:"Fleuve · Réprimander",ex:[{ar:"نَهَر",fr:"Nahar · Fleuve"},{ar:"أَنْهَار",fr:"Anhâr · Fleuves (Coran 2:25)"},{ar:"نَهَارَ",fr:"Nahâr · Jour (le jour)"}]},
  "وحد":{fr:"Unicité · Un seul",ex:[{ar:"وَاحِد",fr:"Wâhid · Un, unique"},{ar:"وَحْدَة",fr:"Wahda · Unité, solitude"},{ar:"تَوْحِيد",fr:"Tawhîd · Monothéisme, unicité d'Allah"},{ar:"الأَحَد",fr:"Al-Ahad · L'Un Absolu"}]},
  "وقت":{fr:"Temps · Moment",ex:[{ar:"وَقْت",fr:"Waqt · Temps, moment"},{ar:"مَوَاقِيت",fr:"Mawâqît · Temps fixes (Coran 2:189)"},{ar:"مُؤَقَّت",fr:"Mouaqqat · Temporaire"}]},
  "وصل":{fr:"Connexion · Arrivée",ex:[{ar:"وَصَلَ",fr:"Wasala · Arriver, connecter"},{ar:"وَصْل",fr:"Wasl · Connexion, union"},{ar:"مَوْصُول",fr:"Mawsoul · Connecté, relié"}]},
  "يقن":{fr:"Certitude · Conviction",ex:[{ar:"يَقِين",fr:"Yaqîn · Certitude absolue"},{ar:"تَيَقَّن",fr:"Tayaqqana · Être certain"},{ar:"أَهْل اليَقِين",fr:"Ahl al-Yaqîn · Les gens de la certitude"}]},
  "يسر":{fr:"Facilité · Aisance",ex:[{ar:"يَسَّرَ",fr:"Yassara · Faciliter"},{ar:"يُسْر",fr:"Yousr · Facilité"},{ar:"إِنَّ مَعَ العُسْرِ يُسْرًا",fr:"'Avec la difficulté vient la facilité' (Coran 94:5)"}]},

  // K-A-F
  "كاف":{fr:"Suffisant · Qui suffit",ex:[{ar:"كَافٍ",fr:"Kâfi · Suffisant"},{ar:"كِفَاية",fr:"Kifâya · Suffisance"}]},
  "اكف":{fr:"Paume · Main ouverte",ex:[{ar:"كَفّ",fr:"Kaff · Paume de la main"},{ar:"أَكُفّ",fr:"Akouff · Paumes"}]},
  "كفا":{fr:"Équivalence · Égalité",ex:[{ar:"كَفَاءة",fr:"Kafâa · Compétence, équivalence"},{ar:"كُفُؤ",fr:"Koufou · Égal, équivalent"}]},
  "فاك":{fr:"Bouche · Parole",ex:[{ar:"فَاكِهَة",fr:"Fâkiha · Fruit"},{ar:"فَكَّ",fr:"Fakka · Libérer, ouvrir"}]},
  "فكا":{fr:"Libération · Défaire",ex:[{ar:"فَكَّ",fr:"Fakka · Libérer"},{ar:"فِكَاك",fr:"Fikâk · Rançon, libération"}]},
  "افك":{fr:"Mensonge · Calomnie",ex:[{ar:"إِفْك",fr:"Ifk · Mensonge, calomnie (Coran 24:11)"},{ar:"آفِك",fr:"Âfik · Menteur"}]},

  // N-W-R
  "ونر":{fr:"Lumière diffuse",ex:[{ar:"وَنَر",fr:"Wanar · Lueur faible"}]},

  // K-T-B
  "كتب":{fr:"Écriture · Prescription",ex:[{ar:"كِتَاب",fr:"Kitâb · Livre"},{ar:"كَتَبَ",fr:"Kataba · Écrire"},{ar:"الكِتَاب",fr:"Al-Kitâb · Le Livre (Coran)"}]},
  "بكت":{fr:"Pleurer · Sangloter",ex:[{ar:"بَكَت",fr:"Bakat · Elle a pleuré"},{ar:"بُكَاء",fr:"Boukâ · Pleurs"}]},
  "تكب":{fr:"Orgueil · Arrogance",ex:[{ar:"تَكَبَّر",fr:"Takabbara · S'enorgueillir"},{ar:"مُتَكَبِّر",fr:"Mutakabbir · Orgueilleux"}]},
  "كبت":{fr:"Répression · Étouffer",ex:[{ar:"كَبَتَ",fr:"Kabata · Réprimer, étouffer"},{ar:"مَكْبُوت",fr:"Makbout · Refoulé"}]},
  "بتك":{fr:"Couper · Trancher",ex:[{ar:"بَتَكَ",fr:"Bataka · Couper net"},{ar:"بَتَّار",fr:"Battâr · Tranchant"}]},
  "تبك":{fr:"Confusion · Mélange",ex:[{ar:"تَبَكَ",fr:"Tabaka · Confondre, mélanger"}]},

  // H-M-D
  "حمد":{fr:"Louange · Gratitude",ex:[{ar:"حَمْد",fr:"Hamd · Louange"},{ar:"أَحْمَد",fr:"Ahmad · Le plus loué ﷺ"},{ar:"مُحَمَّد",fr:"Muhammad · Loué ﷺ"},{ar:"الحَمْدُ لِلّٰه",fr:"Alhamdulillah · Louange à Allah"}]},
  "مدح":{fr:"Éloge · Compliment",ex:[{ar:"مَدَحَ",fr:"Madaha · Louer, complimenter"},{ar:"مَدِيح",fr:"Madîh · Éloge, panégyrique"}]},
  "دحم":{fr:"Pousser · Bousculer",ex:[{ar:"دَحَمَ",fr:"Dahama · Pousser brutalement"}]},
  "حدم":{fr:"Ardeur · Véhémence",ex:[{ar:"حَدَمَ",fr:"Hadama · Être ardent, vif"}]},
  "دمح":{fr:"Surabondance",ex:[{ar:"دَمَحَ",fr:"Damaha · Être surabondant"}]},
  "محد":{fr:"Limite · Frontière",ex:[{ar:"حَدّ",fr:"Hadd · Limite, frontière"},{ar:"مَحْدُود",fr:"Mahdoud · Limité"}]},

  // D-H-K-R / Z-K-R
  "ذكر":{fr:"Rappel · Dhikr · Masculin",ex:[{ar:"ذِكْر",fr:"Dhikr · Rappel d'Allah"},{ar:"تَذَكَّر",fr:"Tadhakkara · Se souvenir"},{ar:"ذَكَر",fr:"Dhakar · Masculin"}]},

  // A-L-H
  "اله":{fr:"Divinité · Adoration",ex:[{ar:"إِلٰه",fr:"Ilâh · Dieu, divinité"},{ar:"اللّٰه",fr:"Allâh · Allah, Le Dieu"},{ar:"تَأَلَّه",fr:"Ta'allaha · Se diviniser"}]},
  "لها":{fr:"Distraction · Oubli",ex:[{ar:"لَهْو",fr:"Lahw · Distraction, jeu futile"},{ar:"لَاهٍ",fr:"Lâhi · Distrait, inattentif"}]},
  "هال":{fr:"Terreur · Effroi",ex:[{ar:"هَالَ",fr:"Hâla · Terrifier"},{ar:"هَوْل",fr:"Hawl · Terreur, effroi"}]},
  "اله":{fr:"Divinité",ex:[{ar:"إِلٰه",fr:"Ilâh · Divinité"},{ar:"آلِهَة",fr:"Âliha · Faux dieux"}]},
  "لاه":{fr:"Transcendance divine",ex:[{ar:"لاهوت",fr:"Lâhout · Divinité, transcendance"}]},
  "هلا":{fr:"Salut · Bienvenue",ex:[{ar:"هَلَّا",fr:"Hallâ · Pourquoi pas, allons !"},{ar:"أَهْلًا وَسَهْلًا",fr:"Ahlan wa sahlan · Bienvenue"}]},

  // S-B-H
  "سبح":{fr:"Gloire · Nager",ex:[{ar:"سُبْحَان",fr:"Soubhân · Gloire à (Dieu)"},{ar:"تَسْبِيح",fr:"Tasbîh · Glorification"},{ar:"سَبَحَ",fr:"Sabaha · Nager, flotter"}]},
  "بسح":{fr:"Générosité · Largesse",ex:[{ar:"بَسَحَ",fr:"Basaha · Être généreux"}]},
  "حسب":{fr:"Calcul · Compte",ex:[{ar:"حَسَبَ",fr:"Hasaba · Calculer"},{ar:"حِسَاب",fr:"Hisâb · Compte, calcul (Jour du Jugement)"}]},
  "بحس":{fr:"Sensation · Perception",ex:[{ar:"بَحَثَ",fr:"Bahatha · Chercher, explorer"}]},
  "حبس":{fr:"Emprisonnement",ex:[{ar:"حَبَسَ",fr:"Habasa · Emprisonner"},{ar:"حَبْس",fr:"Habs · Prison"}]},
  "سحب":{fr:"Tirer · Nuage",ex:[{ar:"سَحَبَ",fr:"Sahaba · Tirer, traîner"},{ar:"سَحَاب",fr:"Sahâb · Nuages"}]},

  // Q-L-B
  "قلب":{fr:"Cœur · Retournement",ex:[{ar:"قَلْب",fr:"Qalb · Cœur"},{ar:"انْقِلَاب",fr:"Inqilâb · Révolution"},{ar:"يُقَلِّب",fr:"Youqallib · Retourner (Coran 3:154)"}]},
  "لبق":{fr:"Habilité · Agilité",ex:[{ar:"لَبِق",fr:"Labiq · Habile, adroit"}]},
  "بقل":{fr:"Plante · Légume",ex:[{ar:"بَقْل",fr:"Baql · Légume, herbe"},{ar:"بَقَّال",fr:"Baqqâl · Épicier"}]},
  "قبل":{fr:"Avant · Accepter",ex:[{ar:"قَبْل",fr:"Qabl · Avant"},{ar:"قَبِلَ",fr:"Qabila · Accepter"},{ar:"قِبْلَة",fr:"Qibla · Direction de La Mecque"}]},
  "لقب":{fr:"Surnom · Titre",ex:[{ar:"لَقَب",fr:"Laqab · Surnom, titre"},{ar:"مُلَقَّب",fr:"Moulaqqab · Surnommé"}]},
  "بلق":{fr:"Bigarré · Ouverture",ex:[{ar:"أَبْلَق",fr:"Ablaq · Bigarré (noir et blanc)"},{ar:"بَلَقَ",fr:"Balaqa · Ouvrir grand"}]},
};
function getRootMeaning(word){
  if(ROOT_DATA[word]) return ROOT_DATA[word].fr;
  // Valeur calculable mais sens non documenté en local
  return null;
  const AR2FR={"ا":"a","ب":"b","ت":"t","ث":"th","ج":"dj","ح":"h","خ":"kh","د":"d","ذ":"dh","ر":"r","ز":"z","س":"s","ش":"sh","ص":"s·","ض":"d·","ط":"t·","ظ":"z·","ع":"'","غ":"gh","ف":"f","ق":"q","ك":"k","ل":"l","م":"m","ن":"n","ه":"h","و":"w","ي":"y"};
  return [...word].map(ch=>AR2FR[ch]||ch).join("-");
}
function getPhonetic(word){
  const AR2FR={"ا":"A","أ":"A","إ":"A","ب":"B","ت":"T","ث":"TH","ج":"DJ","ح":"H","خ":"KH","د":"D","ذ":"DH","ر":"R","ز":"Z","س":"S","ش":"SH","ص":"S","ض":"D","ط":"T","ظ":"Z","ع":"A","غ":"GH","ف":"F","ق":"Q","ك":"K","ل":"L","م":"M","ن":"N","ه":"H","و":"W","ي":"Y","ى":"Y"};
  return[...word].map(ch=>AR2FR[ch]||"").filter(Boolean).join("-");
}
function getRootExamples(word){
  return ROOT_DATA[word]?.ex||[];
}

const ROOT_MEANINGS={
  "رحم":"Miséricorde / Matrice","رحو":"Compassion","مرح":"Joie / Gaieté","حرم":"Sacré / Interdit","حمر":"Rouge / Âne","مرح":"Allégresse",
  "سلم":"Paix / Intégrité","سلا":"Consolation","ملس":"Lisse","لسم":"Incision","مسل":"Couler","لمس":"Toucher",
  "نور":"Lumière","نرو":"Couler","ورن":"Couleur","رون":"Lenteur","ونر":"Soupir","رنو":"Regarder fixement",
  "فتح":"Ouverture / Victoire","فحت":"Charbon","تفح":"Pomme","حفت":"Bord","تحف":"Cadeau précieux","حتف":"Destin / Mort",
  "علم":"Science / Connaissance","لمع":"Briller","معل":"Hauteur","عمل":"Travail","ملع":"Maudit","لعم":"Jurer",
  "صبر":"Patience","صرب":"Frapper","رصب":"Dureté","برص":"Lèpre","بصر":"Vue / Clairvoyance","ربص":"Attendre",
  "حيو":"Vie / Vivifier","وحي":"Révélation","حوي":"Contenir","يحو":"Il vit","وين":"Fatigue","حين":"Moment",
  "قلب":"Cœur / Retournement","لقب":"Surnom","بقل":"Plante","لبق":"Agile","قبل":"Avant / Accepter","بلق":"Bariolé",
  "كرم":"Générosité / Noblesse","ركم":"Entasser","مكر":"Ruse","كمر":"Cacher","رمك":"Jument","مرك":"Centre",
  "حكم":"Sagesse / Jugement","كمح":"Retenir","محك":"Litige","حمك":"Ciel","كحم":"Noircir","مكح":"Fermer les yeux",
  "ذكر":"Rappel / Mention / Masculin","كرذ":"—","ركذ":"—","ذرك":"—","كذر":"—","رذك":"—",
  "محمد":"Loué / Muhammad","أحمد":"Le plus loué","حمد":"Louange",
  "الله":"Allah / Le Dieu","نبي":"Prophète","رسول":"Messager",
};

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
  "ا":{nom:"Al-Wâhid · L'Unique",al:"🍯 Miel (Coran 16:69)",sw:"1 · Al-Fâtiha · Mère du Livre"},
  "ب":{nom:"Al-Bâri · Le Producteur",al:"🌴 Dattes (Hadith Bukhari)",sw:"2 · Al-Baqara"},
  "ج":{nom:"Al-Jabbâr · Le Contraignant",al:"🫒 Huile d'olive (Coran 24:35)",sw:"3 · Âl-Imrân"},
  "د":{nom:"Al-Qayyûm · Le Subsistant",al:"🍃 Figue (Coran 95:1)",sw:"4 · An-Nisâ"},
  "ه":{nom:"Al-Hayy · Le Vivant",al:"🌿 Nigelle (Sahih Bukhari)",sw:"5 · Al-Mâida"},
  "و":{nom:"Al-Wadûd · L'Affectueux",al:"🍎 Grenade (Coran 6:99)",sw:"6 · Al-Anam"},
  "ز":{nom:"Al-Aziz · Le Tout Puissant",al:"🫒 Olives (Coran 95:1)",sw:"7 · Al-Araf"},
  "ح":{nom:"Al-Haqq · La Vérité",al:"🌾 Orge (Tibb Nabawi)",sw:"8 · Al-Anfâl"},
  "ط":{nom:"Al-Latîf · Le Subtil",al:"🍯 Miel de sidr (Hadith)",sw:"9 · At-Tawba"},
  "ي":{nom:"Al-Hakîm · Le Sage",al:"🌵 Figue sèche (Tibb Nabawi)",sw:"10 · Yûnus"},
  "ك":{nom:"Al-Kabîr · Le Grand",al:"🥛 Lait (Hadith Muslim)",sw:"11 · Hûd"},
  "ل":{nom:"Al-Alîm · L'Omniscient",al:"🥛 Lait pur (Coran 16:66)",sw:"12 · Yûsuf"},
  "م":{nom:"Al-Muhyi · Celui qui vivifie",al:"💧 Eau pure (Coran 21:30)",sw:"13 · Ar-Rad"},
  "ن":{nom:"An-Nûr · La Lumière",al:"🐟 Poisson (Coran 37:142)",sw:"68 · Al-Qalam · Noun"},
  "س":{nom:"As-Salâm · La Paix",al:"🌻 Huile de sésame (Tibb)",sw:"36 · Yâ-Sîn"},
  "ع":{nom:"Al-Alîm · Le Savant",al:"🍇 Raisins (Coran 36:34)",sw:"16 · An-Nahl"},
  "ف":{nom:"Al-Fattâh · L'Ouvreur",al:"🍉 Pastèque (Tibb Nabawi)",sw:"17 · Al-Isra"},
  "ص":{nom:"As-Sabûr · Le Patient",al:"🍎 Grenade (Tibb Nabawi)",sw:"38 · Sâd"},
  "ق":{nom:"Al-Qâdir · Le Capable",al:"🌿 Curcuma (Tibb Nabawi)",sw:"50 · Qâf"},
  "ر":{nom:"Ar-Rahmân · Le Miséricordieux",al:"🌿 Menthe (Tibb Nabawi)",sw:"55 · Ar-Rahmân"},
  "ش":{nom:"Ash-Shakûr · Le Reconnaissant",al:"🍯 Miel acacia (Tibb)",sw:"42 · Ash-Shûra"},
  "ت":{nom:"At-Tawwâb · L'Accepteur",al:"🌴 Dattes Ajwa (Hadith)",sw:"9 · At-Tawba"},
  "ث":{nom:"Al-Wârith · L'Héritier",al:"🌿 Thym (Tibb Nabawi)",sw:"51 · Adh-Dhâriyât"},
  "خ":{nom:"Al-Khabîr · L'Informé",al:"⚫ Kohl (Hadith Bukhari)",sw:"59 · Al-Hashr"},
  "ذ":{nom:"Dhul-Jalâl · Maître de Majesté",al:"🌿 Safran (Tibb Nabawi)",sw:"55 · Ar-Rahmân"},
  "ض":{nom:"Ad-Dârr · Celui qui éprouve",al:"🟡 Curcuma (Tibb)",sw:"93 · Ad-Duhâ"},
  "ظ":{nom:"Az-Zâhir · Le Manifeste",al:"🫚 Gingembre (Coran 76:17)",sw:"86 · At-Târiq"},
  "غ":{nom:"Al-Ghafûr · Le Pardonneur",al:"🌿 Cardamome (Tibb Nabawi)",sw:"15 · Al-Hijr"},
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
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
.orb-idle{transform-box:fill-box;transform-origin:center;animation:pulsOrb 3.4s ease-in-out infinite}
.orb-kun{transform-box:fill-box;transform-origin:center;animation:kunPulse 1s ease-in-out 3}
.star{animation:glimmer var(--d) ease-in-out var(--del) infinite}
.fadein{animation:fadeUp .35s ease both}
.lit{animation:litGlow 0.6s ease-in-out infinite}
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
  const [splash,setSplash]       = useState(true);
  const [showPrayers,setShowPrayers] = useState(false);
  const [showArch,setShowArch]   = useState(false);
  const [showHelp,setShowHelp]   = useState(false);
  const [quranV,setQuranV]       = useState(null);
  const [quranLoad,setQuranLoad] = useState(false);
  const [rootHistory,setRootHistory] = useState(()=>{ try{ return JSON.parse(localStorage.getItem("rootHistory")||"[]"); }catch(e){ return []; } });
  const [showAllRoots,setShowAllRoots] = useState(false);
  const [allRootsFilter,setAllRootsFilter] = useState(0);
  const [kunHistory,setKunHistory]   = useState(()=>{ try{ return JSON.parse(localStorage.getItem("kunHistory")||"[]"); }catch(e){ return []; } });
  const [kunMulti,setKunMulti]       = useState(new Set());
  const [kunStep,setKunStep]   = useState(0);
  const [mansion,setMansion]     = useState(null);
  const [inputMode,setInputMode] = useState("ar"); // ar | fr
  const kunTimer               = useRef(null);
  const socketRef=useRef(null);
  const [nafarCount,setNafarCount]=useState(0);
  const drag                   = useRef({on:false,a0:0,r0:0});
  const pinch                  = useRef({on:false,d0:0,z0:1});
  const wrapRef                = useRef(null);

  useEffect(()=>{try{const s=io(window.location.origin,{transports:["websocket","polling"]});socketRef.current=s;s.on("collective_pulse",({count})=>setNafarCount(count));s.on("room_count",({count})=>setNafarCount(count));return()=>s.disconnect();}catch(e){}},[]);

  useEffect(()=>{
    if(navigator.geolocation) navigator.geolocation.getCurrentPosition(p=>setLoc({lat:p.coords.latitude,lng:p.coords.longitude}),()=>{});
  },[]);

  useEffect(()=>{
    const upd=()=>setMansion(getActiveMansion());
    upd();
    const id=setInterval(upd,300000);
    return()=>clearInterval(id);
  },[]);

  useEffect(()=>{
    const upd=()=>setPrayers(calcPrayers(loc.lat,loc.lng));
    upd(); const id=setInterval(upd,60000); return()=>clearInterval(id);
  },[loc]);

  // ── Rotation ──
  // ── ROTATION ROUE — pointer capture ──
  const onPtrDown = useCallback(e=>{
    if(e.button!==undefined&&e.button!==0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current={on:true,lx:e.clientX,r0:rot};
  },[rot]);

  const onPtrMove = useCallback(e=>{
    if(!drag.current.on) return;
    const dx=e.clientX-drag.current.lx;
    setRot(drag.current.r0+dx*.6);
    setHov(null);
  },[]);

  const onPtrUp = useCallback(()=>{ drag.current.on=false; },[]);

  // ── pinch zoom (mobile) ──
  const onTouchStart = useCallback(e=>{
    if(e.touches.length===2){
      const dx=e.touches[0].clientX-e.touches[1].clientX;
      const dy=e.touches[0].clientY-e.touches[1].clientY;
      pinch.current={on:true,d0:Math.hypot(dx,dy),z0:zoom};
    }
  },[zoom]);
  const onTouchMove = useCallback(e=>{
    if(e.touches.length===2&&pinch.current.on){
      const dx=e.touches[0].clientX-e.touches[1].clientX;
      const dy=e.touches[0].clientY-e.touches[1].clientY;
      const d=Math.hypot(dx,dy);
      setZoom(Math.min(2.5,Math.max(.5,pinch.current.z0*(d/pinch.current.d0))));
      e.preventDefault();
    }
  },[]);
  const onTouchEnd = useCallback(()=>{ pinch.current.on=false; },[]);

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

  // Nettoie le texte (retire HTML, marqueurs de fin de verset, notes)
  const cleanTxt = (s)=>{
    if(!s) return "";
    return s.replace(/<[^>]*>/g,"")               // balises HTML
            .replace(/[\uFD3E\uFD3F\uFDFD]/g,"")    // ornements/Basmala ligature
            .replace(/[\u06DD\u06DE\u08E2]/g,"")   // marqueurs fin de verset
            .replace(/[\uFFFD\uFFFC]/g,"")          // caractères de remplacement ❖
            .replace(/\u06DD[\u0660-\u0669]+/g,"") // numéro de verset arabe
            .replace(/[\u0660-\u0669]+\s*$/,"")     // chiffres arabes finaux
            .replace(/\d+\s*$/,"")                  // numéro final latin
            .replace(/\s+/g," ").trim();
  };

  // Récupère les versets réels du Coran où la racine apparaît
  const fetchQuranRoot = useCallback(async(rootStr)=>{
    setQuranLoad(true); setQuranV(null);
    try{
      const r=await fetch("/api/root/"+encodeURIComponent(rootStr));
      const d=await r.json();
      const results=(d.search&&d.search.results)||[];
      const keys=results.slice(0,5).map(v=>v.verse_key).filter(Boolean);
      // Récupère arabe + traduction FR pour chaque verset
      const verses=await Promise.all(keys.map(async k=>{
        try{
          const vr=await fetch("/api/verse/"+encodeURIComponent(k));
          const vd=await vr.json();
          const v=vd.verse||{};
          const fr=(v.translations&&v.translations[0]&&v.translations[0].text)||"";
          return { key:k, ar:cleanTxt(v.text_uthmani||""), fr:cleanTxt(fr) };
        }catch(e){ return { key:k, ar:"", fr:"" }; }
      }));
      setQuranV(verses);
    }catch(e){ setQuranV([]); }
    setQuranLoad(false);
  },[]);

  const illuminate = useCallback((chars,ms=2500)=>{
    const s=new Set([...chars].filter(c=>ABJAD[c]));
    setLit(s); setKunOn(true);
    setTimeout(()=>setKunOn(false),ms);
  },[]);

  const handleKun = useCallback(async(forceWord,forceMode)=>{
    const useWord=(typeof forceWord==="string")?forceWord:input;
    const useMode=forceMode||inputMode;
    const raw=useWord.trim(); if(!raw) return;
    // Convert to Arabic first — all analysis uses Arabic
    const q=useMode==="fr"?frToAr(raw).replace(/\s/g,'').replace(/[^\u0600-\u06ff]/g,''):raw;
    if(!q) return;
    const letters=[...q].filter(ch=>ABJAD[ch]).map(ch=>({char:ch,value:ABJAD[ch]}));
    const total=letters.reduce((s,l)=>s+l.value,0);
    const reduced=reduce(total);
    const constellations=detectConstellation(q);
    const trusted=useMode==="ar"||isFrTrusted(raw);
    setAnalysis({letters,total,reduced,constellations,original:raw,trusted,wasFr:useMode==="fr"});
    setKunHistory(prev=>{ const next=[raw,...prev.filter(r=>r!==raw)].slice(0,10); try{ localStorage.setItem("kunHistory",JSON.stringify(next)); }catch(e){} return next; });
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
  },[input,inputMode,illuminate]);

  const runOracle = useCallback(async(q,oTotal,oReduced)=>{
    setLoading(true);
    try{
      const matchNames=N99.map(n=>({...n,red:reduce(abj(n.ar))})).filter(n=>n.red===oReduced).slice(0,5).map(n=>n.tr).join(", ");
      const res=await fetch("/api/oracle",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-5",max_tokens:1000,
          messages:[{role:"user",content:
            "Tu es NEXUS, oracle de phonosémantique arabe.\n"+
            "Texte : «"+q+"» · Abjad : "+oTotal+" → réduit : "+oReduced+" = "+(ARCH[oReduced]||"?")+"\n"+
            "Noms divins résonnants : "+(matchNames||"—")+"\n\n"+
            "En 3 points concis et clairs, pour quelqu'un qui découvre :\n"+
            "1. Racine triconsonantique et son sens profond.\n"+
            "2. Résonance du nombre "+oReduced+" et lien aux Noms divins.\n"+
            "3. Une piste de méditation bienveillante.\n\n"+
            "RÈGLES IMPORTANTES :\n"+
            "- Réponds principalement en FRANÇAIS clair.\n"+
            "- Chaque fois que tu écris un mot arabe, donne TOUJOURS sa traduction française juste après, entre parenthèses. Ne laisse jamais d'arabe sans traduction.\n"+
            "- Reste humble : tu proposes une réflexion, tu n'affirmes pas une vérité religieuse.\n"+
            "- Style sobre et chaleureux. Maximum 6 lignes."
          }]
        })
      });
      const data=await res.json();
      // Handle both direct API response and proxy response
      let txt="—";
      if(data.content&&Array.isArray(data.content)){
        txt=data.content.filter(b=>b.type==="text").map(b=>b.text).join("")||"—";
      } else if(data.error){
        txt="Erreur API : "+( data.error.message||JSON.stringify(data.error));
      } else if(typeof data==="string"){
        txt=data;
      }
      setAiText(txt);
    }catch(err){setAiText("Erreur connexion oracle.");}
    setLoading(false);
  },[]);

  const selectName=useCallback(name=>{
    setSelName(name);setAnalysis(null);setAiText("");
    illuminate(name.ar,2500);setTab("cristal");setShowNames(false);
  },[illuminate]);

  const rootChars=useMemo(()=>{
    // rootIn is raw french text - convert to arabic for calculation
    const arabic=[...rootIn].some(c=>ABJAD[c]) ? rootIn : frToAr(rootIn).replace(/\s/g,"");
    return[...arabic].filter(c=>ABJAD[c]).slice(0,3);
  },[rootIn]);
  const rootPerms=useMemo(()=>{
    if(rootChars.length!==3) return [];
    const ps=perms(rootChars).map(p=>({word:p.join(""),value:p.reduce((s,l)=>s+(ABJAD[l]||0),0)}));
    // Save to history
    const key=rootChars.join("");
    setRootHistory(prev=>{
      const next=[key,...prev.filter(r=>r!==key)].slice(0,10);
      try{ localStorage.setItem("rootHistory",JSON.stringify(next)); }catch(e){}
      return next;
    });
    return ps;
  },[rootChars]);

  // Auto-fetch quran API quand racine pas dans dictionnaire local
  useEffect(()=>{
    if(rootChars.length===3){
      const key=rootChars.join("");
      if(!ROOT_DATA[key]){
        fetchQuranRoot(key);
      }
    }
  },[rootChars,fetchQuranRoot]);

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
      <svg width={S} height={S} viewBox={"0 0 "+S+" "+S}
        style={{maxWidth:"92vw",maxHeight:"45vh",display:"block",cursor:inv?"default":"grab",touchAction:"none",userSelect:"none"}}
        onPointerDown={inv?undefined:onPtrDown}
        onPointerMove={inv?undefined:onPtrMove}
        onPointerUp={inv?undefined:onPtrUp}
        onPointerCancel={inv?undefined:onPtrUp}
        onTouchStart={inv?undefined:onTouchStart}
        onTouchMove={inv?undefined:onTouchMove}
        onTouchEnd={inv?undefined:onTouchEnd}>
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
              onMouseEnter={()=>{ if(!drag.current.on&&!inv) setHov(letter.deg); }}
              onMouseLeave={()=>setHov(null)}
              onClick={()=>{ if(!inv){ setInputMode('ar'); setInput(p=>(p+letter.l).slice(0,20)); illuminate(letter.l,1200); } }}
              style={{cursor:inv?"default":"pointer"}}>
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


  if(splash) return(
    <div style={{minHeight:"100vh",background:"radial-gradient(ellipse at 50% 35%,#13123a 0%,#0a0a24 55%,#050514 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 24px",boxSizing:"border-box",position:"relative",overflow:"hidden",fontFamily:"Cinzel,Palatino,serif"}}>
      <style>{CSS}</style>
      {STARS.map((s,i)=>(
        <div key={i} className="star" style={{position:"absolute",left:s.x+"%",top:s.y+"%",width:s.r*2,height:s.r*2,borderRadius:"50%",background:"rgba(220,220,255,.9)",pointerEvents:"none","--d":s.dur+"s","--del":s.del+"s"}}/>
      ))}
      <div className="fadein" style={{textAlign:"center",maxWidth:380,position:"relative",zIndex:10}}>
        <div style={{color:G,fontSize:26,fontFamily:"Amiri,serif",direction:"rtl",lineHeight:1.9,filter:"drop-shadow(0 0 16px rgba(232,201,122,.5))",marginBottom:6}}>بِسْمِ اللهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
        <div style={{marginBottom:38}}/>
        <div style={{width:130,height:130,margin:"0 auto 40px",position:"relative"}}>
          <svg viewBox="0 0 130 130" style={{filter:"drop-shadow(0 0 20px rgba(232,201,122,.35))"}}>
            <circle cx="65" cy="65" r="56" fill="none" stroke="rgba(232,201,122,.25)" strokeWidth="1"/>
            <g style={{transformOrigin:"65px 65px",animation:"spin 60s linear infinite"}}>
              <polygon points="65,12 110,93 20,93" fill="none" stroke="rgba(232,201,122,.7)" strokeWidth="1.3"/>
              <polygon points="65,118 20,37 110,37" fill="none" stroke="rgba(184,204,232,.7)" strokeWidth="1.3"/>
            </g>
            <circle cx="65" cy="65" r="20" fill="none" stroke="rgba(232,201,122,.2)" strokeWidth="1"/>
            <circle cx="65" cy="65" r="5" fill="rgba(255,230,150,.95)" style={{filter:"drop-shadow(0 0 8px rgba(255,200,80,.9))"}}/>
            <circle cx="65" cy="65" r="2" fill="#fff"/>
          </svg>
        </div>
        <div style={{color:"rgba(230,210,165,.9)",fontSize:15,fontFamily:"Georgia,serif",lineHeight:1.7,marginBottom:18}}>
          Une balance pour contempler<br/>les Signes de Dieu dans le langage.
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:34,textAlign:"left"}}>
          {[
            ["٢٨","Les 28 lettres arabes et leur valeur (Abjad)"],
            ["٩٩","Les 99 Noms divins et leurs résonances"],
            ["✿","Les racines du Coran et leur géométrie"]
          ].map(([n,t],i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"10px 14px",border:"1px solid rgba(232,201,122,.12)",borderRadius:4,background:"rgba(232,201,122,.03)"}}>
              <span style={{fontSize:20,color:"rgba(232,201,122,.7)",fontFamily:"Amiri,serif",minWidth:28,textAlign:"center"}}>{n}</span>
              <span style={{color:"rgba(220,200,160,.75)",fontSize:11,fontFamily:"Georgia,serif",lineHeight:1.5}}>{t}</span>
            </div>
          ))}
        </div>
        <div style={{color:"rgba(200,180,140,.5)",fontSize:10,fontFamily:"Georgia,serif",lineHeight:1.7,marginBottom:30,fontStyle:"italic"}}>
          Cet outil n'est ni magie, ni divination, ni médecine.<br/>Il ne remplace ni un savant, ni un médecin.<br/>Il invite seulement à méditer.
        </div>
        <button onClick={()=>setSplash(false)} style={{background:"linear-gradient(135deg,rgba(232,201,122,.15),rgba(232,201,122,.05))",border:"1px solid rgba(232,201,122,.4)",color:G,fontSize:11,letterSpacing:4,padding:"13px 40px",cursor:"pointer",fontFamily:"Cinzel,serif",borderRadius:3,filter:"drop-shadow(0 0 12px rgba(232,201,122,.2))"}}>
          ENTRER
        </button>
      </div>
    </div>
  );

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
          <div style={{color:W,fontSize:8,fontFamily:"Amiri,serif",direction:"rtl",marginTop:3}}>١+٥+٦=١٢→٣ · ٣٠+٤٠+٥٠=١٢٠→٣ · هُوَ=١١ · أنا=٥٢</div>
        </div>

        <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:6,marginBottom:6,flexWrap:"wrap"}}>
          {mansion&&(
            <div style={{padding:"5px 10px",border:"1px solid rgba(180,130,255,.22)",borderRadius:6,background:"rgba(180,130,255,.05)",display:"flex",alignItems:"center",gap:9}}>
              <div style={{fontSize:20,color:"rgba(200,160,255,.9)",fontFamily:"Amiri,serif",filter:"drop-shadow(0 0 6px rgba(180,130,255,.5))"}}>{mansion.letter}</div>
              <div>
                <div style={{color:"rgba(200,160,255,.4)",fontSize:6,letterSpacing:1.5}}>{"LUNE Â· "+(mansion.index+1)+"/28"}</div>
                <div style={{color:"rgba(200,160,255,.7)",fontSize:8}}>{mansion.name}</div>
              </div>
            </div>
          )}
          <button onClick={()=>setShowNames(v=>!v)}
            style={{background:showNames?"rgba(232,201,122,.12)":"rgba(232,201,122,.05)",border:"1px solid "+D,color:G,fontSize:7,letterSpacing:2,padding:"7px 12px",cursor:"pointer",fontFamily:"Cinzel,serif",borderRadius:6,flexShrink:0}}>
            99 NOMS ▾
          </button>
          <button onClick={()=>setShowArch(v=>!v)}
            style={{background:showArch?"rgba(232,201,122,.12)":"rgba(232,201,122,.05)",border:"1px solid "+D,color:G,fontSize:7,letterSpacing:2,padding:"7px 12px",cursor:"pointer",fontFamily:"Cinzel,serif",borderRadius:6,flexShrink:0}}>
            ✦ 9 ARCHÉTYPES ▾
          </button>
          {prayers&&(
            <button onClick={()=>setShowPrayers(v=>!v)}
              style={{background:showPrayers?"rgba(232,201,122,.12)":"rgba(232,201,122,.05)",border:"1px solid "+D,color:G,fontSize:7,letterSpacing:2,padding:"7px 12px",cursor:"pointer",fontFamily:"Cinzel,serif",borderRadius:6,flexShrink:0}}>
              ☾ PRIÈRES ▾
            </button>
          )}
        </div>

        {showPrayers&&prayers&&(
          <div className="fadein" style={{display:"flex",justifyContent:"center",gap:5,marginBottom:8,flexWrap:"wrap"}}>
            {["fajr","dhuhr","asr","maghrib","isha"].map(k=>{
              const isA=activePrayer===k;
              return(
                <div key={k} style={{textAlign:"center",padding:"4px 10px",borderRadius:4,background:isA?"rgba(232,201,122,.1)":"transparent",border:"1px solid "+(isA?D:DIM)}}>
                  <div style={{color:isA?PCOL[k]:"rgba(232,201,122,.35)",fontSize:6,letterSpacing:1}}>{PLBL[k]}</div>
                  <div style={{color:isA?G:W,fontSize:10}}>{prayers[k]}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── TABS ── */}
      <div style={{width:"100%",maxWidth:440,display:"flex",borderBottom:"1px solid rgba(232,201,122,.12)",position:"relative",zIndex:10}}>
        {[["cristal","⬡ Cristal"],["racines","✦ Racines"],["inversion","⊘ Zérkâle"],["awraq","◈ Awrâq"]].map(([id,lbl])=>(
          <button key={id} className={"tb"+(tab===id?" on":"")} onClick={()=>{setTab(id);setShowNames(false);}}>{lbl}</button>
        ))}
      </div>


      {/* AIDE CONTEXTUELLE — icône + résumé détaillé + exemple */}
      <div style={{width:"100%",maxWidth:440,padding:"8px 16px 0",boxSizing:"border-box",position:"relative",zIndex:10}}>
        {(()=>{
          const HELP={
            cristal:{ic:"⊕",t:"DÉCRYPTER UN MOT",
              d:"Écris un mot (arabe ou français) et appuie sur Décrypter. Le Cristal décompose le mot en lettres, additionne leurs valeurs Abjad, réduit le total à un archétype (1 à 9), et te montre les Noms divins qui partagent cette vibration.",
              ex:"Exemple : سلام (Paix) = 60+30+1+40 = 131 → 1+3+1 = 5, le Souffle de Vie. Nom résonnant : As-Salâm."},
            racines:{ic:"✦",t:"EXPLORER UNE RACINE",
              d:"Tape 3 lettres. Le Cristal génère les 6 arrangements possibles de ces lettres et montre que tous gardent la même valeur Abjad. Tu peux ensuite voir les versets réels du Coran où la racine apparaît.",
              ex:"Exemple : R-H-M donne رحم (Miséricorde), حرم (Sacré), حمر (Rouge)... tous = 248."},
            inversion:{ic:"⊘",t:"LE MIROIR (ZÉRKÂLE)",
              d:"Un outil pédagogique : il montre comment les mêmes lettres peuvent basculer du sens lumineux vers son ombre. C'est une invitation à réfléchir à l'intention derrière les mots, pas une formule magique.",
              ex:"Exemple : le point central Nûn (50, l'Unité) inversé devient Anâ (52, l'ego)."},
            awraq:{ic:"◈",t:"LES FEUILLES (AWRÂQ)",
              d:"Chaque lettre arabe est reliée à un Nom divin, un aliment cité dans la Sunna, et une sourate — uniquement des correspondances sourcées dans le Coran et le Hadith authentique.",
              ex:"Exemple : la lettre Nûn (ن) est reliée à la sourate Al-Qalam, qui s'ouvre par cette lettre."},
          };
          const h=HELP[tab]; if(!h) return null;
          return(
            <div style={{border:"1px solid rgba(232,201,122,.18)",borderRadius:6,background:"rgba(232,201,122,.03)",overflow:"hidden"}}>
              <div onClick={()=>setShowHelp(v=>!v)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",cursor:"pointer"}}>
                <span style={{fontSize:18,color:G,minWidth:22,textAlign:"center"}}>{h.ic}</span>
                <span style={{flex:1,color:"rgba(232,201,122,.85)",fontSize:9,letterSpacing:2}}>{h.t}</span>
                <span style={{color:"rgba(232,201,122,.5)",fontSize:10}}>{showHelp?"▴":"▾"}</span>
              </div>
              {showHelp&&(
                <div className="fadein" style={{padding:"0 12px 11px",borderTop:"1px solid rgba(232,201,122,.08)"}}>
                  <div style={{color:"rgba(220,200,160,.7)",fontSize:9.5,fontFamily:"Georgia,serif",lineHeight:1.6,marginTop:9}}>{h.d}</div>
                  <div style={{color:"rgba(232,201,122,.55)",fontSize:9,fontFamily:"Georgia,serif",fontStyle:"italic",lineHeight:1.6,marginTop:7,paddingTop:7,borderTop:"1px solid rgba(232,201,122,.06)"}}>{h.ex}</div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
      {/* ── CRISTAL ── */}
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
              <><div style={{color:"rgba(232,201,122,.2)",fontSize:7,letterSpacing:4}}>TOURNEZ · ZOOMEZ · KUN</div>
              <div style={{color:"rgba(232,201,122,.15)",fontSize:6.5,letterSpacing:2,marginTop:2}}>TOUCHE UNE LETTRE DU SCEAU POUR L'ÉCRIRE</div></>
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
              {inputMode==="fr"&&<span style={{color:D,fontSize:7,alignSelf:"center",marginLeft:4}}>ex: salam, nour, rahman, mahdi...</span>}
            </div>
            {inputMode==="fr"&&input&&(
              <div style={{textAlign:"right",color:"rgba(232,201,122,.45)",fontSize:12,fontFamily:"Amiri,serif",direction:"rtl",marginBottom:4,minHeight:20}}>
                → {frToAr(input)}
              </div>
            )}

            {/* ── CALCUL EN DIRECT ── */}
            {(()=>{
              const raw=inputMode==="ar"?input:frToAr(input);
              const liveLetters=[...raw].filter(ch=>ABJAD[ch]).map(ch=>({char:ch,val:ABJAD[ch]}));
              if(liveLetters.length===0) return null;
              const liveTotal=liveLetters.reduce((s,l)=>s+l.val,0);
              const liveRed=reduce(liveTotal);
              const archCol={1:"#FFD700",2:"#C8E8FF",3:"#FFB0D0",4:"#90E0FF",5:"#B8FFB8",6:"#FFD0A0",7:"#E8C8FF",8:"#FFE0FF",9:"#C8FFF0"};
              return(
                <div className="fadein" style={{marginBottom:8,padding:"8px 10px",background:"rgba(232,201,122,.04)",border:"1px solid rgba(232,201,122,.12)",borderRadius:4}}>
                  {/* Lettres avec valeurs */}
                  <div style={{display:"flex",gap:4,justifyContent:"flex-end",flexWrap:"wrap",direction:"rtl",marginBottom:6}}>
                    {liveLetters.map((l,i)=>(
                      <div key={i} style={{textAlign:"center",padding:"3px 5px",border:"1px solid rgba(232,201,122,.2)",borderRadius:3,background:"rgba(232,201,122,.05)",minWidth:30}}>
                        <div style={{fontSize:18,color:G,fontFamily:"Amiri,serif",lineHeight:1}}>{l.char}</div>
                        <div style={{fontSize:8,color:archCol[reduce(l.val)]||G,marginTop:1,filter:"drop-shadow(0 0 3px currentColor)"}}>{l.val}</div>
                      </div>
                    ))}
                  </div>
                  {/* Total + réduction */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"1px solid rgba(232,201,122,.08)",paddingTop:5}}>
                    <div style={{color:"rgba(232,201,122,.5)",fontSize:8}}>
                      {liveLetters.map(l=>l.val).join(" + ")} = <span style={{color:G,fontSize:10}}>{liveTotal}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      <span style={{color:"rgba(232,201,122,.4)",fontSize:7}}>→</span>
                      <span style={{fontSize:13,color:archCol[liveRed]||G,fontFamily:"Amiri,serif",filter:"drop-shadow(0 0 5px currentColor)"}}>{ROOT_L[liveRed]||""}</span>
                      <span style={{fontSize:9,color:archCol[liveRed]||G}}>{liveRed}</span>
                      <span style={{fontSize:7,color:"rgba(232,201,122,.5)",fontStyle:"italic"}}>{ARCH[liveRed]||""}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleKun()}
                placeholder={inputMode==="ar"?"أدخل كلمة أو نية...":"Tape en français : salam, nour..."}
                style={{flex:1,background:"rgba(8,6,22,.9)",border:"none",borderBottom:"1px solid "+D,color:G,fontSize:inputMode==="ar"?20:15,padding:"8px 4px",fontFamily:inputMode==="ar"?"Amiri,serif":"Cinzel,serif",direction:inputMode==="ar"?"rtl":"ltr",textAlign:inputMode==="ar"?"right":"left",borderRadius:0}}/>
              <button onClick={handleKun} disabled={loading}
                style={{background:loading?"transparent":"rgba(232,201,122,.08)",border:"1px solid "+D,color:loading?W:G,fontSize:9,letterSpacing:2.5,padding:"8px 14px",cursor:loading?"default":"pointer",fontFamily:"Cinzel,serif",borderRadius:2}}>
                {loading?"·":"KUN"}
              </button>
            </div>

            {/* ── HISTORIQUE KUN ── */}
            {kunHistory.length>0&&(
              <div style={{marginTop:8,marginBottom:4}}>
                <div style={{color:"rgba(232,201,122,.35)",fontSize:7,letterSpacing:2,marginBottom:4}}>DERNIÈRES RECHERCHES</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {kunHistory.map((w,i)=>(
                    <button key={i} onClick={()=>{setInput(w);setInputMode([...w].some(c=>ABJAD[c])?"ar":"fr");setTimeout(()=>handleKun(w,[...w].some(c=>ABJAD[c])?"ar":"fr"),30);}}
                      style={{background:"rgba(232,201,122,.05)",border:"1px solid rgba(232,201,122,.18)",borderRadius:12,padding:"4px 11px",cursor:"pointer",color:G,fontSize:[...w].some(c=>ABJAD[c])?15:10,fontFamily:[...w].some(c=>ABJAD[c])?"Amiri,serif":"Cinzel,serif"}}>
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── ACTIVATION MULTIPLE — MOTS DU CORAN ── */}
            {(()=>{
              const QURAN_WORDS=[
                {ar:"سلام",fr:"Paix"},{ar:"نور",fr:"Lumière"},{ar:"رحمة",fr:"Miséricorde"},
                {ar:"صبر",fr:"Patience"},{ar:"هدى",fr:"Guidance"},{ar:"حق",fr:"Vérité"},
                {ar:"أمان",fr:"Sécurité"},{ar:"شكر",fr:"Gratitude"},{ar:"توبة",fr:"Repentir"},
                {ar:"علم",fr:"Science"},{ar:"حياة",fr:"Vie"},{ar:"إيمان",fr:"Foi"},
              ];
              return(
                <div style={{marginTop:8,marginBottom:4}}>
                  <div style={{color:"rgba(232,201,122,.4)",fontSize:7,letterSpacing:2,marginBottom:5}}>✦ ILLUMINER PLUSIEURS MOTS SUR LE SCEAU</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:6}}>
                    {QURAN_WORDS.map(w=>{
                      const on=kunMulti.has(w.ar);
                      return(
                        <button key={w.ar} onClick={()=>{
                          setKunMulti(prev=>{
                            const next=new Set(prev);
                            if(on) next.delete(w.ar); else next.add(w.ar);
                            // Illuminate all selected words
                            const allChars=new Set([...next].flatMap(a=>[...a].filter(c=>ABJAD[c])));
                            illuminate(allChars.size>0?[...allChars].join(""):"",5000);
                            return next;
                          });
                        }}
                          style={{background:on?"rgba(232,201,122,.18)":"rgba(232,201,122,.05)",border:"1px solid "+(on?"rgba(232,201,122,.6)":"rgba(232,201,122,.2)"),borderRadius:14,padding:"5px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                          <span style={{fontSize:14,color:G,fontFamily:"Amiri,serif"}}>{w.ar}</span>
                          <span style={{fontSize:7,color:"rgba(232,201,122,.5)"}}>{w.fr}</span>
                        </button>
                      );
                    })}
                  </div>
                  {kunMulti.size>0&&(
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{color:"rgba(232,201,122,.5)",fontSize:7.5,fontStyle:"italic"}}>
                        Valeur cumulée : {[...kunMulti].flatMap(a=>[...a].filter(l=>ABJAD[l])).reduce((s,l)=>s+(ABJAD[l]||0),0)}
                      </div>
                      <button onClick={()=>{ setKunMulti(new Set()); illuminate("",0); }}
                        style={{background:"none",border:"1px solid rgba(200,100,100,.3)",borderRadius:10,padding:"3px 8px",cursor:"pointer",color:"rgba(200,100,100,.6)",fontSize:7}}>✕ EFFACER</button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Exemples guidés — pour le découvreur */}
            {!analysis&&(
              <div className="fadein" style={{marginTop:12,textAlign:"center"}}>
                <div style={{color:"rgba(232,201,122,.4)",fontSize:8,letterSpacing:1,marginBottom:7}}>Essaie un de ces mots pour découvrir :</div>
                <div style={{display:"flex",gap:6,justifyContent:"center",flexWrap:"wrap"}}>
                  {[["salam","Paix"],["nour","Lumière"],["rahma","Miséricorde"],["sabr","Patience"]].map(([w,fr])=>(
                    <button key={w} onClick={()=>{setInput(w);setInputMode("fr");handleKun(w,"fr");}}
                      style={{background:"rgba(232,201,122,.05)",border:"1px solid rgba(232,201,122,.25)",borderRadius:20,padding:"6px 13px",cursor:"pointer",fontFamily:"Cinzel,serif"}}>
                      <span style={{color:G,fontSize:10}}>{w}</span>
                      <span style={{color:"rgba(232,201,122,.4)",fontSize:7,marginLeft:5}}>{fr}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {analysis&&(
              <div className="fadein" style={{marginTop:10,background:"rgba(8,6,22,.96)",border:"1px solid rgba(232,201,122,.15)",borderRadius:3,padding:"13px 14px",maxHeight:320,overflowY:"auto"}}>
                {analysis.letters.length===0?(
                  <div style={{color:W,fontSize:9,textAlign:"center"}}>Aucune lettre arabe détectée</div>
                ):(
                  <div>
                    {analysis.original&&analysis.original!==analysis.letters.map(l=>l.char).join("")&&(
                      <div style={{textAlign:"right",color:"rgba(232,201,122,.5)",fontSize:10,fontFamily:"Amiri,serif",direction:"rtl",marginBottom:6,paddingBottom:6,borderBottom:"1px solid rgba(232,201,122,.08)"}}>
                        <span style={{fontSize:7,letterSpacing:1,color:"rgba(232,201,122,.3)"}}>CONVERTI EN ARABE : </span>
                        {analysis.letters.map(l=>l.char).join("")}
                      </div>
                    )}
                    {analysis.wasFr&&!analysis.trusted&&(
                      <div style={{display:"flex",gap:8,alignItems:"flex-start",background:"rgba(180,140,40,.08)",border:"1px solid rgba(220,170,60,.3)",borderRadius:4,padding:"8px 10px",marginBottom:10}}>
                        <span style={{fontSize:13,flexShrink:0}}>⚠</span>
                        <div>
                          <div style={{color:"rgba(230,190,100,.9)",fontSize:9,lineHeight:1.5}}>Conversion approximative depuis le français.</div>
                          <div style={{color:"rgba(220,180,120,.6)",fontSize:8,lineHeight:1.5,marginTop:2}}>Pour une valeur exacte, écris ce mot directement en arabe (bouton عربي AR).</div>
                        </div>
                      </div>
                    )}
                    <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:10,direction:"rtl"}}>
                      {analysis.letters.map((l,i)=>(
                        <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",border:"1px solid rgba(232,201,122,.2)",borderRadius:2,padding:"3px 7px",background:"rgba(232,201,122,.04)"}}>
                          <span style={{fontSize:19,color:G,fontFamily:"Amiri,serif",lineHeight:1.2}}>{l.char}</span>
                          <span style={{fontSize:7,color:W}}>{l.value}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"1px solid rgba(232,201,122,.1)",paddingTop:8,marginBottom:6}}>
                      <span style={{color:W,fontSize:9}}>Σ {analysis.total} <span style={{fontSize:7,opacity:.6}}>valeur totale</span></span>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{color:G,fontSize:12}}>→ {analysis.reduced}</span>
                        <span style={{color:G,fontSize:20,fontFamily:"Amiri,serif",filter:"drop-shadow(0 0 6px rgba(232,201,122,.5))"}}>{ROOT_L[analysis.reduced]||""}</span>
                        <div style={{color:"rgba(232,201,122,.75)",fontSize:8}}>{ARCH[analysis.reduced]||""}</div>
                      </div>
                    </div>
                    {ARCH_SENSE[analysis.reduced]&&(
                      <div style={{color:"rgba(220,200,160,.6)",fontSize:9,fontFamily:"Georgia,serif",fontStyle:"italic",lineHeight:1.6,marginBottom:8,paddingLeft:4}}>{ARCH_SENSE[analysis.reduced]}</div>
                    )}
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
                    {aiText&&aiText!=="—"&&(
                      <div style={{borderTop:"1px solid rgba(232,201,122,.1)",paddingTop:10,marginTop:6}}>
                        <div style={{color:"rgba(230,205,155,.9)",fontSize:10.5,lineHeight:1.85,fontFamily:"Georgia,serif",whiteSpace:"pre-wrap",marginBottom:8}}>{aiText}</div>
                        <div style={{color:"rgba(232,201,122,.25)",fontSize:7,letterSpacing:1,borderTop:"1px solid rgba(232,201,122,.08)",paddingTop:6,fontFamily:"Cinzel,serif",textAlign:"center"}}>
                          ⚠ Réflexion proposée par IA · Non substituable à un avis d'aalim · Allâh seul détient la Science
                        </div>
                      </div>
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
          {/* ── CLAVIER FR→AR ── */}
          {(()=>{
            const FR_KEYS=[
              ["a","ا"],["b","ب"],["t","ت"],["th","ث"],["j","ج"],["h","ح"],
              ["kh","خ"],["d","د"],["dh","ذ"],["r","ر"],["z","ز"],["s","س"],
              ["sh","ش"],["s.","ص"],["d.","ض"],["t.","ط"],["z.","ظ"],["a`","ع"],
              ["gh","غ"],["f","ف"],["q","ق"],["k","ك"],["l","ل"],["m","م"],
              ["n","ن"],["h2","ه"],["w","و"],["y","ي"]
            ];
            return(
              <div style={{marginBottom:10}}>
                <div style={{color:"rgba(232,201,122,.4)",fontSize:7,letterSpacing:2,marginBottom:5,textAlign:"center"}}>CLAVIER · CLIQUE POUR AJOUTER UNE LETTRE</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:3,justifyContent:"center"}}>
                  {FR_KEYS.map(([fr,ar])=>{
                    const val=ABJAD[ar]||0;
                    return(
                    <button key={fr} onClick={()=>setRootIn(p=>{
                      const next=(p+ar).replace(/[^\u0600-\u06ff]/g,"");
                      return next.slice(0,3);
                    })}
                      style={{background:"rgba(232,201,122,.07)",border:"1px solid rgba(232,201,122,.22)",borderRadius:4,padding:"3px 4px",cursor:"pointer",minWidth:34,textAlign:"center"}}>
                      <div style={{fontSize:16,color:"rgba(255,230,120,1)",fontFamily:"Amiri,serif",lineHeight:1,filter:"drop-shadow(0 0 4px rgba(255,220,80,.4))"}}>{ar}</div>
                      <div style={{fontSize:8,color:(()=>{
                        const arch=reduce(val);
                        const cols={1:"#FFD700",2:"#C8E8FF",3:"#FFB0B0",4:"#90E0FF",5:"#B8FFB8",6:"#FFD0A0",7:"#E8C8FF",8:"#FFE0FF",9:"#C8FFF0"};
                        return cols[arch]||"rgba(255,200,60,.9)";
                      })(),letterSpacing:.5,marginTop:1,fontFamily:"Cinzel,serif",filter:"drop-shadow(0 0 3px currentColor)"}}>{val}</div>
                      <div style={{fontSize:5.5,color:"rgba(232,201,122,.4)",letterSpacing:.5}}>{fr}</div>
                    </button>
                    );
                  })}
                  <button onClick={()=>setRootIn("")}
                    style={{background:"rgba(200,80,80,.08)",border:"1px solid rgba(200,80,80,.2)",borderRadius:4,padding:"4px 8px",cursor:"pointer",color:"rgba(200,100,100,.7)",fontSize:8}}>✕</button>
                </div>
              </div>
            );
          })()}

          {/* ── SAISIE ── */}
          <div style={{display:"flex",gap:8,marginBottom:4}}>
            <input value={rootIn} onChange={e=>setRootIn(e.target.value)}
              placeholder="3 lettres arabes · ex: ر-ح-م"
              style={{flex:1,background:"rgba(8,6,22,.9)",border:"none",borderBottom:"1px solid "+D,color:G,fontSize:22,padding:"8px 4px",fontFamily:"Amiri,serif",direction:"rtl",textAlign:"right",borderRadius:0}}/>
            <button onClick={()=>setRootIn("")}
              style={{background:"none",border:"none",color:"rgba(232,201,122,.3)",fontSize:16,cursor:"pointer",padding:"0 4px"}}>✕</button>
          </div>

          {/* ── HISTORIQUE ── */}
          {rootHistory.length>0&&(
            <div style={{marginBottom:10}}>
              <div style={{color:"rgba(232,201,122,.35)",fontSize:7,letterSpacing:2,marginBottom:4}}>DERNIÈRES RECHERCHES</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                {rootHistory.map((r,i)=>(
                  <button key={i} onClick={()=>setRootIn(r)}
                    style={{background:"rgba(232,201,122,.05)",border:"1px solid rgba(232,201,122,.18)",borderRadius:12,padding:"4px 10px",cursor:"pointer",color:G,fontSize:14,fontFamily:"Amiri,serif"}}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── TOUTES LES RACINES ── */}
          <button onClick={()=>setShowAllRoots(v=>!v)}
            style={{width:"100%",background:"rgba(232,201,122,.04)",border:"1px solid rgba(232,201,122,.15)",borderRadius:4,padding:"8px",cursor:"pointer",color:"rgba(232,201,122,.6)",fontSize:8,letterSpacing:2,fontFamily:"Cinzel,serif",marginBottom:10}}>
            {showAllRoots?"▴ FERMER":"▾ EXPLORER LES RACINES VÉRIFIÉES ("+Object.keys(ROOT_DATA).filter(k=>k.length===3).length+")"}
          </button>

          {showAllRoots&&(
            <div className="fadein" style={{marginBottom:12}}>
              <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8,justifyContent:"center"}}>
                <button onClick={()=>setAllRootsFilter(0)}
                  style={{background:allRootsFilter===0?"rgba(232,201,122,.15)":"rgba(232,201,122,.04)",border:"1px solid rgba(232,201,122,.2)",borderRadius:10,padding:"4px 10px",cursor:"pointer",color:G,fontSize:7,letterSpacing:1}}>TOUTES</button>
                {[1,2,3,4,5,6,7,8,9].map(n=>(
                  <button key={n} onClick={()=>setAllRootsFilter(n)}
                    style={{background:allRootsFilter===n?"rgba(232,201,122,.15)":"rgba(232,201,122,.04)",border:"1px solid rgba(232,201,122,.2)",borderRadius:10,padding:"4px 8px",cursor:"pointer",color:G,fontSize:7}}>
                    {n} · {ARCH[n]}
                  </button>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,maxHeight:240,overflowY:"auto"}}>
                {Object.entries(ROOT_DATA).filter(([k,v])=>{
                  if(k.length!==3) return false;
                  if(allRootsFilter===0) return true;
                  const val=k.split("").reduce((s,l)=>s+(ABJAD[l]||0),0);
                  return reduce(val)===allRootsFilter;
                }).map(([k,v])=>(
                  <button key={k} onClick={()=>{setRootIn(k);setShowAllRoots(false);}}
                    style={{background:"rgba(232,201,122,.03)",border:"1px solid rgba(232,201,122,.12)",borderRadius:3,padding:"6px 4px",cursor:"pointer",textAlign:"center"}}>
                    <div style={{fontSize:16,color:G,fontFamily:"Amiri,serif"}}>{k}</div>
                    <div style={{fontSize:6.5,color:"rgba(232,201,122,.5)",lineHeight:1.3,marginTop:2}}>{v.fr.slice(0,18)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {rootIn&&(
            <div style={{textAlign:"right",color:"rgba(232,201,122,.5)",fontSize:20,fontFamily:"Amiri,serif",direction:"rtl",marginBottom:10}}>
              → {([...rootIn].some(c=>ABJAD[c])?rootIn:frToAr(rootIn).replace(/\s/g,""))}
            </div>
          )}
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
                    <div style={{color:"rgba(232,201,122,.4)",fontSize:9,marginTop:2,fontFamily:"Cinzel,serif",textAlign:"center",letterSpacing:2}}>{getPhonetic(p.word)}</div>
                    <div style={{color:"rgba(232,201,122,.6)",fontSize:8,marginTop:2,fontFamily:"Georgia,serif",textAlign:"center",direction:"ltr"}}>{getRootMeaning(p.word)}</div>
                    {getRootExamples(p.word).slice(0,2).map((ex,ei)=>(
                      <div key={ei} style={{marginTop:3,textAlign:"center"}}>
                        <span style={{color:G,fontSize:11,fontFamily:"Amiri,serif"}}>{ex.ar}</span>
                        <span style={{color:"rgba(232,201,122,.45)",fontSize:6.5,display:"block",direction:"ltr"}}>{ex.fr}</span>
                      </div>
                    ))}
                    <div style={{color:W,fontSize:7,marginTop:4}}>{p.value}</div>
                  </div>
                ))}
              </div>

              {/* Bouton : voir dans le Coran */}
              <button onClick={()=>fetchQuranRoot(rootChars.join(""))}
                style={{width:"100%",marginTop:12,background:"rgba(232,201,122,.08)",border:"1px solid rgba(232,201,122,.3)",color:G,fontSize:9,letterSpacing:2,padding:"10px",cursor:"pointer",fontFamily:"Cinzel,serif",borderRadius:4}}>
                {quranLoad?"RECHERCHE DANS LE CORAN...":"☛ VOIR CETTE RACINE DANS LE CORAN"}
              </button>

              {quranV&&(
                <div className="fadein" style={{marginTop:10}}>
                  {quranV.length===0?(
                    <div style={{color:"rgba(232,201,122,.4)",fontSize:9,textAlign:"center",padding:"10px",fontStyle:"italic"}}>Aucune occurrence trouvée pour cette racine dans le Coran.</div>
                  ):(
                    <>
                      <div style={{color:"rgba(232,201,122,.4)",fontSize:7,letterSpacing:2,marginBottom:6,textAlign:"center"}}>
                        MOTS DE CETTE RACINE DANS LE CORAN · SOURCE: QURAN.COM / LEEDS
                      </div>
                      {quranV.map((v,i)=>(
                        <div key={i} style={{padding:"8px 10px",border:"1px solid rgba(232,201,122,.1)",borderRadius:3,background:"rgba(232,201,122,.02)",marginBottom:6}}>
                          <div style={{color:G,fontSize:15,fontFamily:"Amiri,serif",direction:"rtl",textAlign:"right",lineHeight:1.9}}>{v.ar}</div>
                          <div style={{color:"rgba(220,200,160,.7)",fontSize:9.5,fontFamily:"Georgia,serif",fontStyle:"italic",marginTop:5,lineHeight:1.55}}>{v.fr||"(traduction indisponible)"}</div>
                          <div style={{color:"rgba(232,201,122,.35)",fontSize:7,marginTop:3}}>Coran {v.key}</div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── INVERSION ── */}
      {tab==="inversion"&&(
        <div style={{width:"100%",maxWidth:440,padding:"14px 16px",boxSizing:"border-box"}}>
          <div style={{textAlign:"center",marginBottom:14}}>
            <div style={{color:"rgba(200,90,90,.85)",fontSize:11,letterSpacing:3,marginBottom:6}}>ZÉRKÂLE · LE MIROIR DE L'EGO</div>
            <div style={{fontSize:28,fontFamily:"Amiri,serif",color:"rgba(200,90,90,.7)",direction:"rtl"}}>أنا</div>
            <div style={{color:"rgba(200,90,90,.5)",fontSize:8,marginTop:2}}>Anâ · « moi »  ·  valeur 52</div>
          </div>

          {/* Descriptif principal */}
          <div style={{border:"1px solid rgba(180,90,90,.2)",borderRadius:8,padding:"14px 15px",background:"rgba(40,15,20,.35)",marginBottom:14}}>
            <div style={{color:"rgba(230,180,180,.9)",fontSize:11,fontFamily:"Georgia,serif",lineHeight:1.75}}>
              Au centre du Sceau veille le <strong style={{color:G}}>Nûn (ن · 50)</strong> — le Point primordial, le souffle de l'Unité. Tout y est tourné vers Allah.
            </div>
            <div style={{color:"rgba(230,180,180,.8)",fontSize:11,fontFamily:"Georgia,serif",lineHeight:1.75,marginTop:10}}>
              L'ego — <strong style={{color:"rgba(220,120,120,.95)"}}>Anâ (أنا · 52)</strong>, « moi » — ne crée rien de neuf. Il prend les mêmes lettres, la même Lumière, et les retourne vers lui-même. Deux unités de plus que le Nûn : juste assez pour se mettre à la place du centre.
            </div>
            <div style={{color:"rgba(230,180,180,.8)",fontSize:11,fontFamily:"Georgia,serif",lineHeight:1.75,marginTop:10}}>
              C'est la ruse d'Iblîs : il n'invente pas de mots, il <strong style={{color:"rgba(220,120,120,.95)"}}>inverse l'intention</strong>. La paix devient soumission forcée, la lumière devient éblouissement, la science devient orgueil. Mêmes lettres, cœur retourné.
            </div>
          </div>

          {/* Comment l'ego retourne — exemples */}
          <div style={{color:"rgba(200,90,90,.6)",fontSize:8,letterSpacing:2,marginBottom:8,textAlign:"center"}}>COMMENT L'EGO RETOURNE LE SENS</div>
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {[
              ["Le Souffle","ه · Hâ","devient","الهوى","Al-hawâ — la passion qui asservit"],
              ["L'Unité","ا · Alif","devient","الكبر","Al-kibr — l'orgueil qui se croit seul"],
              ["La Parole","ق · Qâf","devient","القهر","Al-qahr — la domination par la force"],
              ["Le Lien","و · Wâw","devient","الوهن","Al-wahn — l'attachement qui affaiblit"],
            ].map(([fr,ar,arrow,inv,gl],i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",border:"1px solid rgba(180,90,90,.15)",borderRadius:6,background:"rgba(30,12,15,.3)"}}>
                <div style={{textAlign:"center",minWidth:54}}>
                  <div style={{color:G,fontSize:16,fontFamily:"Amiri,serif"}}>{ar.split(" · ")[0]}</div>
                  <div style={{color:"rgba(232,201,122,.55)",fontSize:7}}>{fr}</div>
                </div>
                <div style={{color:"rgba(200,90,90,.5)",fontSize:8,minWidth:42,textAlign:"center"}}>↩ {arrow}</div>
                <div style={{flex:1}}>
                  <div style={{color:"rgba(220,120,120,.9)",fontSize:15,fontFamily:"Amiri,serif",direction:"rtl",textAlign:"right"}}>{inv}</div>
                  <div style={{color:"rgba(200,150,150,.55)",fontSize:8,fontFamily:"Georgia,serif",fontStyle:"italic",textAlign:"right"}}>{gl}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{color:"rgba(200,150,150,.45)",fontSize:8.5,fontFamily:"Georgia,serif",fontStyle:"italic",lineHeight:1.6,marginTop:14,textAlign:"center"}}>
            Le miroir n'est pas un pouvoir : c'est un avertissement. Il rappelle que la même lettre sert Allah ou sert l'ego — et que seule l'intention (niyya) décide.
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
                {[
                  ["Nom divin résonnant",CORR[selCorr.l].nom],
                  ["Aliment (Tibb Nabawi)",CORR[selCorr.l].al],
                  ["Sourate associée",CORR[selCorr.l].sw]
                ].map(([lbl,val])=>(
                  <div key={lbl} style={{padding:"8px",border:"1px solid rgba(232,201,122,.12)",borderRadius:1,background:"rgba(232,201,122,.03)",gridColumn:"span 2"}}>
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
      {showArch&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,background:"rgba(4,3,20,.98)",border:"1px solid rgba(232,201,122,.2)",borderRadius:"10px 10px 0 0",padding:"14px 14px 20px",maxHeight:"72vh",display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{color:G,fontSize:10,letterSpacing:3}}>✦ LES 9 ARCHÉTYPES · LA TABLE DU TRÔNE</div>
            <button onClick={()=>setShowArch(false)} style={{background:"none",border:"1px solid "+D,color:W,fontSize:8,padding:"4px 9px",cursor:"pointer",fontFamily:"Cinzel,serif",borderRadius:2}}>✕</button>
          </div>
          <div style={{color:D,fontSize:8.5,lineHeight:1.6,marginBottom:12,fontStyle:"italic"}}>Toute valeur Abjad se réduit (somme de ses chiffres) à un nombre de 1 à 9. Ce nombre est l'archétype vibratoire du mot. Exemple : Salâm = 131 → 1+3+1 = 5, le Souffle de Vie.</div>
          <div style={{overflowY:"auto",flex:1,display:"flex",flexDirection:"column",gap:6}}>
            {ARCHETYPES.map(a=>{
              const active=analysis&&analysis.reduced===a.n;
              return(
                <div key={a.n} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",border:"1px solid "+(active?"rgba(232,201,122,.5)":"rgba(232,201,122,.12)"),borderRadius:6,background:active?"rgba(232,201,122,.1)":"rgba(232,201,122,.02)"}}>
                  <div style={{textAlign:"center",minWidth:38}}>
                    <div style={{fontSize:26,color:G,fontFamily:"Amiri,serif",lineHeight:1,filter:active?"drop-shadow(0 0 8px rgba(232,201,122,.6))":"none"}}>{a.l}</div>
                    <div style={{fontSize:13,color:"rgba(232,201,122,.6)",marginTop:2}}>{a.n}</div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                      <span style={{color:G,fontSize:12,fontFamily:"Cinzel,serif"}}>{a.arch}</span>
                      <span style={{color:"rgba(232,201,122,.4)",fontSize:8}}>{a.nom}</span>
                    </div>
                    <div style={{color:"rgba(220,200,160,.6)",fontSize:9,lineHeight:1.5,marginTop:3,fontFamily:"Georgia,serif"}}>{a.ess}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
