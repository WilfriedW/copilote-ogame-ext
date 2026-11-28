/* ---------- les événements ----------
   Ce que fait un clic ou une saisie dans le panneau. `bind` repose, à chaque
   dessin, les écoutes des éléments que `render` vient de créer. Les écoutes
   déléguées à la vue, aux onglets et aux boutons de l'en-tête, posées une
   seule fois, sont regroupées dans `brancheEcoutes`. app.js l'appelle là où
   elles étaient posées avant, si bien que leur ordre ne change pas : deux
   écoutes du même clic s'exécutent dans l'ordre où elles ont été posées.
   `allerOnglet` et `allerVers` changent d'onglet ou de sous-onglet.

   Module des vues (issue #49). Il emprunte encore à app.js presque tout ce
   que les clics changent : ce cycle-là est toléré tant qu'app.js existe, et
   rien n'y est lu au chargement. */
import { coloSystem, colonyCandidates } from '../colonisation/colonisation.js';
import { COL_SHIP_COST } from '../flotte/coques.js';
import { KEY, sample, newPlanet, S, remplaceEtat } from '../core/etat.js';
import { fmt, num } from '../core/format.js';
import { IS_EXT, API } from '../core/serveur.js';
import { timeMode } from '../core/temps.js';
import { DEF_MODELES, DEF_RATIO, DEF_PALIERS, DEF_DUREES, DEF_PLANCHERS } from '../defense/defense.js';
import { stockNow } from '../economie/production.js';
import { EXPO_PREP_MAX, EXPO_PREP_TTL } from '../flotte/expeditions.js';
import { rescanner, LIFEFORMS, lfPosePaliers } from '../formes-de-vie/formes-de-vie.js';
import {
  parseLeft, unlockAudio, chime, stopFlash, finishTimer, clock,
  visibleTimers, renderTimers
} from '../minuteurs/minuteurs.js';
import { applyReport } from '../pillage/pillage.js';
import { dayValue, styleRepose } from '../plan/journee.js';
import { nightLen, absenceJour } from '../plan/nuit.js';
import {
  prioLvl, prioPose, posePartout, poseRetireTout, poseCoche, poseChamp,
  prioDevant, prioRetire
} from '../plan/priorites.js';
import { profilConnu, poseProfilEtape } from '../plan/profil.js';
import { aSoi, REGLES_PAR_ID, reglePose, ignores } from '../regles/moteur.js';
import { secu, fsRappelVu, armeRappel } from '../securite/securite.js';
import { defPersoLive } from './defense.js';
import {
  RELEVE_NUIT, poseScanEcran, faitLeReleve, boutonMaj, header, setTimeMode,
  modeNuit, finDeNuit, masque, masqueBascule, setMasque
} from './entete.js';
import {
  view, tab, poseOnglet, uiNote, uiReset, cardMode, cardTabs, cardForce,
  CARTES, cartesSync, carteDetails, carteChoisie, carteRetiens,
  setCardMode, CARTES_DEF, cartesVal, voirPlusCle, voirPlusOuvert,
  garderVue
} from './navigation.js';
import { pushLook } from './page-du-jeu.js';
import {
  save, planetById, forgetPlanet, toast, render, refresh, timeExport, TOOLS,
  VIEWS, REFRESH, on, msg, appliqueSauvegarde, publieLePlan
} from '../../app.js';

/* ---------- events ---------- */
export function bind(){
  /* Un centre et un seul : cocher ici décoche ailleurs, et comme le choix
     déplace le « (conseillé) » des autres cartes et tout le plan, la vue se
     redessine au lieu de se rafraîchir. */
  view.querySelectorAll('[data-centre]').forEach(el=>el.addEventListener('change',()=>{ S.centre = el.checked ? el.dataset.centre : null; save(); render(); }));
  view.querySelectorAll('[data-raid]').forEach(el=>el.addEventListener(el.type==='checkbox'?'change':'input',()=>{ if(!S.raid) return; const k=el.dataset.raid; if(k==='paste'){ applyReport(el.value); save(); render(); return; } S.raid[k] = el.type==='checkbox' ? el.checked : (+el.value||0); if(k!=='safe') S.raid.at=Date.now(); save(); REFRESH.explore(); }));
  view.querySelectorAll('[data-empile]').forEach(el=>el.addEventListener('change',()=>setCardMode(el.checked ? 'stacked' : 'tabs')));
  view.querySelectorAll('[data-lf]').forEach(el=>el.addEventListener('change',()=>{ const k=el.dataset.lf, f=new Set(S.lf.found); el.checked ? f.add(k) : f.delete(k); S.lf.found=[...f]; save(); render(); }));
  /* Répondre, c'est à la fois choisir et passer à la suite : le plan entier
     change, donc la vue se redessine — et l'assistant disparaît à la dernière
     réponse. Chaque clé est relue dans sa table avant d'être posée. */
  view.querySelectorAll('[data-pstyle]').forEach(el=>el.addEventListener('click',()=>{
    const k = profilConnu(PROFILS.styles, el.dataset.pstyle); if(!k) return;
    /* Avant d'écraser le style : la règle a besoin de celui d'avant pour savoir
       si le plan et le modèle de défense en place venaient de lui ou du joueur. */
    styleRepose(S.profil.style, k);
    S.profil.style = k;
    // La question a été posée, quoi qu'il advienne des réglages qu'elle propose.
    S.day.focusSet = true;
    poseProfilEtape(1); save(); render();
  }));
  view.querySelectorAll('[data-pclasse]').forEach(el=>el.addEventListener('click',()=>{
    S.profil.classe = profilConnu(PROFILS.classes, el.dataset.pclasse) || '';
    poseProfilEtape(2); save(); render();
  }));
  view.querySelectorAll('[data-pactivite]').forEach(el=>el.addEventListener('click',()=>{
    const k = profilConnu(PROFILS.activites, el.dataset.pactivite); if(!k) return;
    S.profil.activite = k; S.profil.set = true; poseProfilEtape(0); save(); render();
  }));
  view.querySelectorAll('[data-petape]').forEach(el=>el.addEventListener('click',()=>{
    poseProfilEtape(Math.max(0, Math.min(2, parseInt(el.dataset.petape) || 0))); render();
  }));
  /* Qui ouvre l'assistant pour voir doit pouvoir en sortir : sans ça, « Refaire
     le questionnaire » laissait la carte en tête d'Aujourd'hui, au-dessus de ce
     que le joueur vient lire, jusqu'à ce qu'il reclique les trois réponses.
     « Fermer » ne défait rien — ce qui a déjà été cliqué est déjà posé — il
     referme, et le bouton n'existe pas tant qu'aucun style n'a été choisi. */
  view.querySelectorAll('[data-pferme]').forEach(el=>el.addEventListener('click',()=>{
    if(!S.profil.style) return;
    S.profil.set = true; poseProfilEtape(0); save(); render();
  }));
  /* Un focus se coche là où le joueur lit ses cartes : l'ordre change à
     l'instant, c'est ce qu'il vient vérifier. */
  view.querySelectorAll('[data-pfocus]').forEach(el=>el.addEventListener('change',()=>{
    const k = profilConnu(PROFILS.focus, el.dataset.pfocus); if(!k) return;
    const f = new Set(S.profil.focus); el.checked ? f.add(k) : f.delete(k);
    S.profil.focus = [...f]; save(); render();
  }));
  /* Refaire le questionnaire, c'est le rouvrir là où il s'ouvre : en tête
     d'Aujourd'hui, avec les réponses en place. */
  view.querySelectorAll('[data-refaire]').forEach(el=>el.addEventListener('click',()=>{
    S.profil.set = false; poseProfilEtape(0); save(); allerOnglet('today');
  }));
  view.querySelectorAll('[data-day]').forEach(el=>el.addEventListener(el.tagName==='SELECT' || el.type==='checkbox' ? 'change' : 'input',()=>{
    // la mise à l'abri est une bascule (ENH-54) : sa valeur est cochée ou non
    const k = el.dataset.day; S.day[k] = dayValue(k, el.type==='checkbox' ? (el.checked ? '1' : '0') : el.value, S.day[k]);
    /* Allumer la mise à l'abri, ou déplacer l'heure de retour, déplace l'instant
       où elle s'éteindra : `modeNuit` le recalcule, le champ ne fait que poser
       la valeur. */
    if(k === 'night') modeNuit(S.day.night);
    if(k === 'backHour' && S.day.night) modeNuit(true);
    save();
    /* Le mode nuit filtre les cartes et change l'en-tête : il faut tout
       redessiner, pas seulement rafraîchir le volet. */
    k === 'night' ? render() : refresh();
  }));
  view.querySelectorAll('[data-colo]').forEach(el=>el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{
    const k = el.dataset.colo;
    S.colo[k] = k==='built' ? el.value==='1' : k==='bonus' ? (+el.value||0) : el.value.trim();
    save(); refresh();
  }));

  view.querySelectorAll('[data-pi]').forEach(card=>{
    const p = S.planets[+card.dataset.pi];
    card.querySelectorAll('input[data-b]').forEach(el=>el.addEventListener('input',()=>{ p.b[el.dataset.b]=Math.max(0,parseInt(el.value)||0); delete p.bNeuve; changed(); }));
    card.querySelectorAll('input[data-p]').forEach(el=>el.addEventListener('input',()=>{ const k=el.dataset.p; p[k] = (k==='tmax'||k==='sats') ? (parseInt(el.value)||0) : el.value; changed(); }));
    card.querySelectorAll('input[data-s]').forEach(el=>el.addEventListener('input',()=>{ const st=stockNow(p); p.stock={m:st[0],c:st[1],d:st[2],at:Date.now()}; p.stock[el.dataset.s]=parseFloat(el.value)||0; changed(); }));
    /* Trois états, et le vide en est un : hériter du compte n'est pas la même
       chose que dire non ici. */
    card.querySelectorAll('[data-satsok]').forEach(el=>el.addEventListener('change',()=>{ p.satsOk = el.value === '' ? null : el.value === '1'; changed(); }));
  });
  view.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{ const p=S.planets[+b.dataset.del]; if(p) forgetPlanet(p.id); save(); render(); }));
  on('addPlanet','click',()=>{ S.planets.push(newPlanet('Colonie '+S.planets.length,'1:1:'+(S.planets.length+4),20,{})); S.sample=false; save(); render(); });
  /* « change » et non « input » comme les niveaux voisins : sur un labo 5,
     taper « 10 » passe par « 1 », que prioPose jugerait atteint avant de
     recréer la priorité en fin de liste — et le joueur perdrait son rang. */
  view.querySelectorAll('input[data-prio]').forEach(el=>el.addEventListener('change',()=>{ const kind = el.dataset.kind || (el.dataset.pid ? 'b' : 't');
    /* Une case de forme de vie se range sous un identifiant entier, et
       l'attribut le donne en chaîne : prioLvl ne la retrouverait pas au relire. */
    const cle = kind === 'lf' ? +el.dataset.prio : el.dataset.prio;
    prioPose(kind, el.dataset.pid, cle, el.value);
    /* Pas de render() : il refermerait le volet qui porte le champ, et le
       joueur qui en pose deux de suite devrait le rouvrir à chaque fois. Le
       champ dit ce que la priorité est devenue — vide si elle a été retirée. */
    el.value = prioLvl(kind, el.dataset.pid, cle);
    save(); refresh();
    // refresh() sur Empire ne publie pas le plan : la tuile ne saurait rien de ce qu'on vient de poser
    publieLePlan();
  }));
  /* La carte de pose en masse. « change » pour la même raison que les champs de
     priorité juste au-dessus : un rendu au milieu de la frappe reprendrait la
     main sur le champ. render() et non refresh() : chaque ligne porte un état
     que le bâtiment ou le niveau change, et la carte se replie sur son état
     enregistré, pas sur celui du gabarit. */
  view.querySelectorAll('[data-pose]').forEach(el=>el.addEventListener('change',()=>{
    poseChamp(el.dataset.pose, el.value); save(); render();
  }));
  view.querySelectorAll('[data-posep]').forEach(el=>el.addEventListener('change',()=>{
    poseCoche(el.dataset.posep, el.checked); save(); render();
  }));
  view.querySelectorAll('input[data-t]').forEach(el=>el.addEventListener('input',()=>{ S.tech[el.dataset.t]=Math.max(0,parseInt(el.value)||0); changed(); }));
  /* La sécurité vit dans `S.settings.secu`, toujours réécrite entière depuis
     `secu()` : une sauvegarde abîmée en sort complète. Tout changement réarme
     le rappel, dont l'heure et les jours vivent aussi côté service worker. */
  const secuPose = f => { const c = secu(); f(c); S.settings.secu = c; changed(); armeRappel(); };
  view.querySelectorAll('[data-secu-vault]').forEach(el=>el.addEventListener('change',()=>secuPose(c=>{
    const id = el.dataset.secuVault; c.vaults = c.vaults.filter(x=>x!==id); if(el.checked) c.vaults.push(id); })));
  view.querySelectorAll('[data-secu-jour]').forEach(el=>el.addEventListener('change',()=>secuPose(c=>{
    const j = +el.dataset.secuJour; c.jours = c.jours.filter(x=>x!==j); if(el.checked) c.jours.push(j); c.jours.sort(); })));
  view.querySelectorAll('[data-secu]').forEach(el=>el.addEventListener('change',()=>secuPose(c=>{
    const k = el.dataset.secu;
    if(/^\d{1,2}:\d{2}$/.test(el.value)) c[k] = el.value;
  })));
  view.querySelectorAll('[data-set]').forEach(el=>el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{
    const k=el.dataset.set, s=S.settings;
    if(k==='ratio'){ const r=el.value.split(':').map(Number); if(r.length===3 && r.every(x=>x>0)) s.ratio=r; }
    else if(['geo','eng','colCargo','lean','noshop','large','peau','clair','crawlerOverload','muet','sats'].includes(k)) s[k]=el.checked;
    else if(k==='skin') s.skin=el.value;
    else s[k]=Math.max(k==='top1'||k==='expoRes'?0:1, parseFloat(el.value)||0);
    changed();
    /* Le worker sonne panneau fermé : il ne lit pas les réglages, on lui pose
       donc ce seul bit là où il regarde. */
    if(k==='muet' && IS_EXT) try{ chrome.storage.local.set({muet: s.muet}); }catch(e){}
    /* `changed()` ne redessine pas : la peau se pose sur <html>, pas dans la vue. */
    if(k==='skin') header();
    if(k==='lean' || k==='noshop' || k==='large' || k==='peau' || k==='clair' || k==='skin') pushLook();
  }));
  view.querySelectorAll('[data-masque]').forEach(el=>el.addEventListener('change',()=>{
    setMasque(Object.assign({}, masque, {[el.dataset.masque]: el.checked}));
  }));
  view.querySelectorAll('[data-masque-tout]').forEach(el=>el.addEventListener('click',()=>setMasque(masqueBascule(masque))));
  view.querySelectorAll('[data-expo]').forEach(el=>el.addEventListener('change',()=>{ S.expo.pf=el.checked; changed(); }));
  view.querySelectorAll('[data-mc]').forEach(el=>el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{ const k=el.dataset.mc; S.moonCalc[k] = (k==='pid'||k==='ship') ? el.value : Math.max(0, parseInt(el.value, 10)||0); changed(); }));
  /* Le modèle de défense passe tout entier par ici : le réglage global, le
     palier, chaque pièce du ratio perso, et la surcharge d'une planète, que
     `data-dp` distingue. Un menu vide retire la surcharge plutôt que de poser
     une valeur : sans ça le joueur ne pourrait plus revenir aux réglages.
     `render()` et pas `refresh()` : le choix du modèle fait apparaître ou
     disparaître les cases du ratio, et la carte entière change. */
  const defPose = (q, v) => {
    if(!q) S.settings.defModele = DEF_MODELES[v] ? v : 'framework';
    else if(DEF_MODELES[v]) q.defModele = v; else delete q.defModele;
  };
  /* Le sélecteur de modèle est un volet de boutons : un clic pose le modèle
     comme le faisait le menu, et le rendu referme le volet. */
  view.querySelectorAll('[data-defpick]').forEach(el=>el.addEventListener('click',()=>{
    defPose(el.dataset.dp ? planetById(el.dataset.dp) : null, el.dataset.defpick);
    S.sample = false; save(); render();
  }));
  /* Le ratio perso se relit à chaque frappe : la recette et le pack suivent
     en direct, et le `change` d'après redessine comme avant. */
  view.querySelectorAll('[data-def]').forEach(el=>{ if(DEF_RATIO.includes(el.dataset.def)) el.addEventListener('input',()=>{
    S.settings.defPerso[el.dataset.def] = Math.max(0, Math.round(num(el.value, 0)));
    defPersoLive();
  }); });
  view.querySelectorAll('[data-def]').forEach(el=>el.addEventListener('change',()=>{
    const k = el.dataset.def, q = el.dataset.dp ? planetById(el.dataset.dp) : null, v = el.value;
    if(k === 'modele') defPose(q, v);
    else if(k === 'palier'){
      const n = v === 'fill' ? 'fill' : DEF_PALIERS.includes(+v) ? +v : null;
      if(!q) S.settings.defPalier = n == null ? 20 : n;
      else if(n == null) delete q.defPalier; else q.defPalier = n;
    /* Le ratio du joueur : des nombres entiers, jamais négatifs. C'est la seule
       valeur de ce bloc qu'il écrit lui-même, donc la seule à borner. */
    }else if(k === 'plancher') S.settings.defPlancher = DEF_PLANCHERS.includes(+v) && v !== '' ? +v : null;
    else if(k === 'duree') S.settings.defDuree = DEF_DUREES.includes(+v) ? +v : 4;
    else if(DEF_RATIO.includes(k)) S.settings.defPerso[k] = Math.max(0, Math.round(num(v, 0)));
    S.sample = false; save(); render();
  }));
  view.querySelectorAll('[data-fc]').forEach(el=>el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{ S.fleetCalc[el.dataset.fc] = el.dataset.fc==='pct'?+el.value:el.value.trim(); changed(); }));
  view.querySelectorAll('[data-ship]').forEach(el=>el.addEventListener('input',()=>{ S.fleetCalc.ships[el.dataset.ship]=Math.max(0,parseInt(el.value)||0); changed(); }));
  /* Le presse-papiers du panneau latéral refuse l'écriture dès que le focus est
     ailleurs, et la sauvegarde partait alors en silence : un fichier, lui,
     atterrit dans le dépôt, qui est le seul endroit que les deux postes
     partagent. `saveAs` pour pouvoir viser ce dossier plutôt que
     Téléchargements. L'URL n'est pas révoquée : le téléchargement démarre après
     le retour, et le panneau fermé la libère de toute façon. */
  on('ioSave','click',()=>{
    // les deux heures de l'enregistrement, quel que soit le mode d'affichage
    const url = URL.createObjectURL(new Blob([JSON.stringify(Object.assign({}, S, timeExport(Date.now())))], {type:'application/json'}));
    if(typeof chrome!=='undefined' && chrome.downloads){
      chrome.downloads.download({url, filename:'save.json', saveAs:true}, ()=>msg('Enregistre-le dans le dépôt, puis pousse-le'));
    } else {
      const a=document.createElement('a'); a.href=url; a.download='save.json'; a.click(); msg('Enregistré dans tes téléchargements');
    }
  });
  on('ioLoad','click',()=>document.getElementById('ioFile').click());
  on('ioFile','change',e=>{ const f=e.target.files && e.target.files[0]; e.target.value=''; if(!f) return;
    f.text().then(t=>{ if(appliqueSauvegarde(t)) toast('Données importées'); else msg('Fichier invalide : choisis le save.json du dépôt'); })
      .catch(()=>msg('Lecture du fichier impossible')); });
  on('ioImport','click',()=>{ if(appliqueSauvegarde(document.getElementById('ioText').value)) toast('Données importées'); else msg('Texte invalide : colle une sauvegarde complète'); });
  on('uiReset','click',()=>{ uiReset(); render(); toast('Affichage des cartes réinitialisé'); });
  on('ioReset','click',e=>{ const b=e.currentTarget; if(b.dataset.armed){ remplaceEtat(sample()); save(); render(); toast('Réinitialisé'); } else { b.dataset.armed='1'; b.textContent='Confirmer la réinitialisation'; b.classList.remove('ghost'); } });
}
export function changed(){ S.sample=false; save(); refresh(); }

export function allerOnglet(k){ poseScanEcran(false); poseOnglet(k); try{ LS.setItem(KEY+'-tab',k); }catch(err){} render(); }
/**
 * Ouvre une page et, s'il est donné, son sous-onglet : « settings:affichage »,
 * « tools:defense ». Le sous-onglet devient le choix retenu du joueur, comme
 * s'il l'avait cliqué : c'est bien lui qui a cliqué le renvoi.
 * @param {string} cible « page » ou « page:sous-onglet »
 */
export function allerVers(cible){
  const [t, sous] = String(cible || '').split(':');
  if(!VIEWS[t]) return;
  if(sous){
    if(t === 'tools'){ if(TOOLS.some(([k])=>k===sous)){ S.ui.tool = sous; save(); } }
    else if(CARTES[t] && CARTES[t].some(c=>c.cardId===sous)){ cardTabs[t] = sous; delete cardForce[t]; carteRetiens(); }
  }
  allerOnglet(t);
  if(typeof window !== 'undefined' && typeof window.scrollTo === 'function') window.scrollTo(0, 0);
}
/** Les écoutes posées une fois, au démarrage : un second appel les doublerait. */
export function brancheEcoutes(){
  // Un clic sur la carte ouvre la page du jeu. Les boutons gardent leur rôle :
  // « Lancé » et « Fait » ne doivent jamais faire changer de page par surprise.
  /* Les menus de limite sont délégués : ceux d'Aujourd'hui vivent dans des
     blocs que le rafraîchissement réécrit, sans repasser par bind(). Le choix
     s'applique tout de suite : le rafraîchissement relit la limite, rien à
     recharger. Changer l'en-tête crée une valeur propre à la liste, comme le
     tableau de Réglages — c'est la même clé, donc les deux restent d'accord. */
  view.addEventListener('change', e=>{
    const el = e.target;
    if(!el || !el.dataset) return;
    if(el.dataset.cartes != null || el.dataset.cartesl != null){
      const id = el.dataset.cartes != null ? el.dataset.cartes : el.dataset.cartesl, v = cartesVal(el.value);
      const l = S.settings.cartesListe = S.settings.cartesListe || {};
      if(v == null) delete l[id]; else l[id] = v;
      save(); tab === 'settings' ? render() : refresh();
    } else if(el.dataset.cartesg != null){
      S.settings.cartesMax = cartesVal(el.value) || CARTES_DEF;
      save(); render();
    }
  });
  /* « Voir plus » déplie sur place : les cartes masquées sont déjà écrites, on
     ne fait que lever le `hidden`. L'état est noté comme celui d'un volet, donc
     le prochain rafraîchissement, et le prochain démarrage, le retrouvent. */
  view.addEventListener('click', e=>{
    /* Un renvoi d'abord : posé dans une carte d'action, il ne doit pas ouvrir
       la page du jeu que la carte ouvre au clic. */
    const rv = e.target.closest('[data-aller]'); if(rv){ e.preventDefault(); e.stopPropagation(); allerVers(rv.dataset.aller); return; }
    const vp = e.target.closest('[data-voirplus]');
    if(vp){
      const id = vp.dataset.voirplus, ouvert = !voirPlusOuvert(id);
      uiNote(voirPlusCle(id), ouvert);
      const box = vp.parentElement && [...vp.parentElement.querySelectorAll('[data-masquees]')].find(x => x.dataset.masquees === id);
      if(box) box.hidden = !ouvert;
      vp.textContent = ouvert ? 'Voir moins' : `Voir ${vp.dataset.n} de plus`;
      vp.setAttribute('aria-expanded', String(ouvert));
      return;
    }
    if(e.target.closest('[data-cartesreset]')){
      S.settings.cartesListe = {};
      save(); render(); toast('Toutes les listes suivent la valeur globale');
    }
  });
  view.addEventListener('click', e=>{
    // « Comment faire » se lit sans partir : seul le corps de la carte navigue.
    if(e.target.closest('button, a, summary, input, select, .how')) return;
    // `closest` rend le plus proche : une coordonnée liée l'emporte sur la carte.
    const li = e.target.closest('[data-go]'); if(!li) return;
    const url = li.dataset.go;
    if(IS_EXT) chrome.runtime.sendMessage({type:'go', url});
    else window.open(url, '_blank', 'noopener');
  });
  /* Les filtres du bloc des conseils vivent dans #tdAlerts, que REFRESH réécrit
     sans repasser par bind() : ils passent par la délégation. Sur ce poste
     seulement — `ui` ne voyage pas. */
  view.addEventListener('change', e=>{
    /* Réglages › Règles : n'est écrit que ce qui s'écarte du fichier. */
    /* La race posée à la main l'emporte sur la lecture ; vide, la lecture reprend. */
    const rc = e.target.closest && e.target.closest('[data-race]');
    if(rc){ const p = planetById(rc.dataset.race);
      if(p){ if(aSoi(LIFEFORMS, rc.value)) p.race = rc.value; else delete p.race; save(); render(); }
      return; }
    const off = e.target.closest && e.target.closest('[data-regoff]');
    if(off){ const [pid, id] = off.dataset.regoff.split('|'), p = planetById(pid);
      if(p && aSoi(REGLES_PAR_ID, id)){ const o = Object.assign({}, p.regOff); if(off.checked) delete o[id]; else o[id] = true; p.regOff = o; save(); render(); }
      return; }
    const ro = e.target.closest && e.target.closest('[data-rg-on]');
    if(ro){ reglePose(ro.dataset.rgOn, {on:!!ro.checked}); save(); render(); return; }
    const rp = e.target.closest && e.target.closest('[data-rg-p]');
    if(rp){ const [id, k] = rp.dataset.rgP.split(':'), v = parseFloat(rp.value);
      if(Number.isFinite(v)) reglePose(id, {p:{[k]: v}}); save(); render(); return; }
    const f = e.target.closest && e.target.closest('[data-cf]'); if(!f) return;
    S.ui.cf = Object.assign({}, S.ui.cf, {[f.dataset.cf]: f.type === 'checkbox' ? !!f.checked : f.value});
    save(); refresh();
  });
  view.addEventListener('click', e=>{
    /* « Préparer » ouvre le formulaire de flotte du jeu, déjà rempli. Un bouton
       et non la carte entière : le clic de carte ignore les boutons exprès, pour
       que « Lancé » et « Fait » ne fassent jamais changer de page par surprise. */
    if(e.target.closest('[data-fsvu]')) fsRappelVu();
    const pr = e.target.closest('[data-prep]');
    if(pr){
      const url = pr.dataset.prep;
      /* Une expédition préparée garde sa composition : si l'aller n'est jamais
         vu, c'est elle qui dira ce qui est parti. */
      if(pr.dataset.expoprep){
        try{
          const x = JSON.parse(pr.dataset.expoprep);
          if(x && typeof x.de === 'string' && typeof x.dest === 'string' && x.ships && typeof x.ships === 'object'){
            const now = Date.now();
            S.expoPrep = (S.expoPrep||[]).filter(y => now - y.at < EXPO_PREP_TTL).concat([{de:x.de, dest:x.dest, ships:x.ships, at:now}]).slice(-EXPO_PREP_MAX);
            save();
          }
        }catch(err){}
      }
      if(IS_EXT) chrome.runtime.sendMessage({type:'go', url});
      else window.open(url, '_blank', 'noopener');
      return;
    }
    /* Le calibrage du fret ne s'applique que sur ce clic. Ignorer retient la
       valeur proposée : la carte revient quand la proposition s'en écarte de
       plus de dix pour cent. */
    const fa = e.target.closest('[data-fretapply]');
    if(fa){ const v = Math.round(+fa.dataset.fretapply); if(v >= 1 && v <= 1e5){ S.settings.expoFret = v; S.expo.fretIgnore = null; save(); render(); toast(`Facteur de fret : ${fmt(v)}`); } return; }
    const fi = e.target.closest('[data-fretignore]');
    if(fi){ const v = +fi.dataset.fretignore; if(v > 0){ S.expo.fretIgnore = v; save(); render(); } return; }
    const cp = e.target.closest('[data-copos]');
    if(cp){ const pos = +cp.dataset.copos, libre = (API && API.planets ? colonyCandidates() : []).find(c=>c.pos===pos), [g,sy] = coloSystem();
      S.colo.target = libre ? libre.coords : `${g}:${sy}:${pos}`; save(); render(); return; }
  });
  view.addEventListener('click', e=>{
    // Le ⓘ de la ligne du type ouvre son texte, posé plus bas dans la carte.
    const wq = e.target.closest('button.i');
    if(wq){
      const body = document.getElementById(wq.getAttribute('aria-controls'));
      if(body){ body.hidden = !body.hidden; wq.setAttribute('aria-expanded', String(!body.hidden)); if(wq.dataset.ui) uiNote(wq.dataset.ui, !body.hidden); }
      return;
    }
    const cp = e.target.closest('[data-copy]');
    if(cp){
      const v = cp.dataset.copy;
      // Le presse-papier, pas le champ : c'est le joueur qui colle.
      (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject())
        .then(()=>toast('Copié : '+v)).catch(()=>toast('Copie impossible : '+v));
      return;
    }
    const dn = e.target.closest('[data-done]'); if(dn){ S.daily.done[dn.dataset.done] = Date.now();
      // Fait sur un espionnage : les cibles nommées sortent de la liste pour un jour.
      if(dn.dataset.mark) dn.dataset.mark.split(',').forEach(c=>{ S.raids[c] = {at:Date.now(), probe:true}; }); save(); refresh(); toast('Bien joué'); return; }
    const no = e.target.closest('[data-no]'); if(no){ S.daily.no[no.dataset.no] = Date.now(); save(); refresh(); toast('Mis de côté'); return; }
    /* « Ignorer » ne vit que jusqu'à ce que la situation change, ou 24 h : ce
       n'est pas « Non », qui oublie une carte du plan pour toujours. */
    const rs = e.target.closest('[data-rescan]'); if(rs){ rescanner(); save(); render(); toast('Noms oubliés : ouvre les pages Formes de vie pour les relire'); return; }
    const ig = e.target.closest('[data-ign]'); if(ig){ S.daily.ign = Object.assign({}, ignores(), {[ig.dataset.ign]: Date.now()}); save(); refresh(); toast('Masqué jusqu\'à ce que ça change'); return; }
    const pu = e.target.closest('[data-prio-up]'); if(pu){ prioDevant(pu.dataset.prioUp); save(); render(); publieLePlan(); return; }
    const pd = e.target.closest('[data-prio-del]'); if(pd){ prioRetire(pd.dataset.prioDel); save(); render(); return; }
    /* publieLePlan() comme après un champ de priorité : sans lui, les tuiles du
       jeu ignoreraient ce qu'on vient de poser sur dix planètes d'un coup. */
    const pg = e.target.closest('[data-posego]');
    if(pg){ const n = posePartout();
      if(n){ save(); render(); publieLePlan(); toast(`Posé sur ${n} planète${n>1?'s':''}`); }
      return; }
    const pdel = e.target.closest('[data-posedel]');
    if(pdel){ const n = poseRetireTout();
      if(n){ save(); render(); publieLePlan(); toast(`Retiré sur ${n} planète${n>1?'s':''}`); }
      return; }
    const lp = e.target.closest('[data-lfpaliers]');
    if(lp){ const p = planetById(lp.dataset.lfpaliers);
      if(p && lfPosePaliers(p)){ save(); render(); publieLePlan(); toast('Paliers de population posés'); }
      return; }
    const n1 = e.target.closest('[data-noone]'); if(n1){ delete S.daily.no[n1.dataset.noone]; save(); render(); toast('Carte remise'); return; }
    const nc = e.target.closest('[data-noclear]'); if(nc){ S.daily.no = {}; save(); render(); toast('Cartes refusées remises'); return; }
    const ctb = e.target.closest('[data-carte-tab]'); if(ctb){ carteChoisie(ctb.dataset.carteTab); return; }
    const sm = e.target.closest('summary[data-fold]');
    /* En onglets, la carte affichée reste dépliée : son titre ne la replie pas,
       et l'état enregistré pour le mode empilé ne bouge pas. */
    if(sm && cardMode === 'tabs'){ const w = sm.parentElement.closest('.en-onglets > .carte'); if(w && carteDetails(w) === sm.parentElement){ e.preventDefault(); return; } }
    // Le repli bascule tout seul : on ne note que l'état où il va.
    if(sm){ uiNote(sm.dataset.fold, !sm.parentElement.open); return; }
    const rpp = e.target.closest('[data-raidprep]'); if(rpp){ S.raid = {coords:rpp.dataset.raidprep, name:rpp.dataset.raidname, m:0, c:0, d:0, safe:false}; save(); render(); return; }
    const rpc = e.target.closest('[data-raidclose]'); if(rpc){ S.raid = null; save(); render(); return; }
    const ct = e.target.closest('[data-cotarget]'); if(ct){ S.colo.target = ct.dataset.cotarget; save(); render(); toast('Destination de colonie mise à jour'); return; }
    const ar = e.target.closest('[data-apirefresh]'); if(ar){ try{ chrome.runtime.sendMessage({type:'apiRefresh', force:true}); }catch(err){} toast('Actualisation demandée'); return; }
    const tl = e.target.closest('[data-tool]'); if(tl){ S.ui.tool = tl.dataset.tool; save(); render(); return; }
    const go = e.target.closest('[data-goto]'); if(go){ allerVers(go.dataset.goto); return; }
    const sent = e.target.closest('[data-sent]'); if(sent){ S.colo.sentAt = Date.now(); S.colo.built = false; save(); refresh(); toast('Colonisation en route'); return; }
    const la = e.target.closest('[data-launch]');
    if(la){
      const a = JSON.parse(la.dataset.launch), tm = {id:Math.random().toString(36).slice(2,8), manual:true, at:Date.now(), end:Date.now()+a.dur*1000, done:false};
      if(a.kind==='t'){ tm.kind='t'; tm.k=a.k; tm.lvl=a.lvl; if(a.pid){ tm.pid=a.pid; S.rechPid=a.pid; } }
      else if(a.kind==='b'){ tm.kind='b'; tm.pid=a.pid; tm.k=a.k; tm.lvl=a.lvl; }
      else if(a.kind==='shipbuild' || a.kind==='def'){ tm.kind='x'; tm.k='shipyard'; tm.ships=a.ships; tm.pid=a.pid; tm.label=a.what; }
      else if(a.kind==='transfer' || a.kind==='raid'){ tm.kind='x'; tm.k='fleet'; tm.ships=a.ships; tm.pid=a.pid; tm.label=a.kind==='raid' ? `Retour du pillage ${a.coords}` : 'Arrivée du rapatriement'; }
      else if(a.kind==='expo'){ tm.kind='x'; tm.k='expo'; tm.ships=a.ships; tm.pid=a.pid; tm.label="Retour d'expédition"; }
      else if(a.kind==='sats'){ tm.kind='x'; tm.k='sats'; tm.n=a.n; tm.pid=a.pid; tm.label=a.what; }
      else if(a.kind==='lf'){ tm.kind='x'; tm.k='other'; tm.queue=lfQueue(a.id); tm.pid=a.pid; tm.label=a.what; }
      else { tm.kind='x'; tm.k='colship'; tm.label='Vaisseau de colonisation'; }
      /* Sans planète identifiée, personne n'est débité : c'était le dernier
         endroit où un rang périmé faisait payer la voisine. Le minuteur part
         quand même — le joueur a bien lancé quelque chose. */
      const p = planetById(a.pid);
      const cost = a.cost || COL_SHIP_COST;
      if(p){ const st = stockNow(p); p.stock = {m:Math.max(0,st[0]-cost[0]), c:Math.max(0,st[1]-cost[1]), d:Math.max(0,st[2]-cost[2]), at:Date.now()}; }
      if(a.kind==='raid'){ S.raids[a.coords] = {at:Date.now()}; S.raid = null; }
      S.timers.push(tm); save(); a.kind==='raid' ? render() : refresh(); toast(`Suivi : ${a.what}`);
    }
  });

  view.addEventListener('click', e=>{ if(e.target.id==='scanStop') boutonMaj(); });
  document.getElementById('majBtn').addEventListener('click', boutonMaj);
  /* L'âge du relevé vieillit tout seul : sans ce battement, le bouton n'apparaîtrait
     qu'au prochain clic du joueur — au moment où il se fie déjà au plan. */
  setInterval(header, 60000);
  document.getElementById('tabs').addEventListener('click',e=>{ const b=e.target.closest('button[data-tab]'); if(!b) return; allerOnglet(b.dataset.tab); });
  /* Les deux boutons de l'en-tête sont posés une fois pour toutes : ils ne sont
     pas refaits à chaque dessin, et `bind()` les doublerait. */
  document.getElementById('gearBtn').addEventListener('click',()=>allerOnglet('settings'));
  document.getElementById('nightBtn').addEventListener('click',()=>{
    const allume = !S.day.night;
    modeNuit(allume); save(); render();
    /* La carte du coucher chiffre ce qui part et ce qui reste : sur un stock lu
       il y a deux heures, elle charge des transporteurs sur des ressources
       dépensées depuis, et oublie celles qui se sont accumulées. Le coucher est
       justement le moment où le joueur accepte d'attendre une relecture. */
    if(allume && IS_EXT) faitLeReleve(RELEVE_NUIT);
    /* Allumé en pleine journée, le bouton vaut « je m'absente » : sans ce mot le
       joueur ne sait pas sur quelle heure de retour le plan vient de se caler. */
    if(absenceJour(Date.now())) toast(S.day.backHour == null
      ? `Absence de ${nightLen()} h supposée — Réglages pour l'heure de retour`
      : `Absence jusqu'à ${S.day.backHour} h`);
  });
  document.getElementById('tzBtn').addEventListener('click',()=>setTimeMode(timeMode === 'local' ? 'server' : 'local'));
  view.addEventListener('click', e=>{
    if(e.target.id==='tmSound'){ unlockAudio(); chime(); }
    if(e.target.id==='tmAdd'){
      unlockAudio();
      const sec = parseLeft(document.getElementById('tmLeft').value);
      if(sec==null || sec<=0){ toast('Durée non reconnue : colle par exemple 2h 13m 05s'); return; }
      const [kind,a,b] = document.getElementById('tmWhat').value.split(':');
      const tm = {id:Math.random().toString(36).slice(2,8), kind, end:Date.now()+sec*1000, done:false};
      if(kind==='t'){ tm.k=a; tm.lvl=S.tech[a]+1; }
      else if(kind==='b'){ const p=planetById(a); if(!p) return; tm.pid=a; tm.k=b; tm.lvl=p.b[b]+1; }
      else tm.k=a;
      S.timers.push(tm); save(); document.getElementById('tmLeft').value=''; renderTimers(); toast(`Minuteur lancé : ${clock(sec)}`);
    }
    const rmT = e.target.closest('[data-tmrm]');
    if(rmT){ S.timers = S.timers.filter(t=>t.id!==rmT.dataset.tmrm); save(); stopFlash(); renderTimers(); }
  });
  setInterval(tickTimers, 1000);
  /* publieLePlan est sans effet sur Aujourd'hui, qui se publie en se dessinant ;
     sur Empire, REFRESH.empire ne publie rien : sans cet appel la tuile resterait muette. */
  setInterval(()=>{ if(tab==='today'||tab==='empire') garderVue(()=>{ REFRESH[tab](); cartesSync(); }); publieLePlan(); finDeNuit(); }, 30000);
}
export function tickTimers(){
  const now = Date.now(); let changed=false;
  for(const tm of S.timers){ if(!tm.done && tm.end<=now){ finishTimer(tm); changed=true; } }
  const list = document.getElementById('tmList');
  if(list){
    if(changed || list.dataset.count !== String(visibleTimers().length)) renderTimers();
    else S.timers.forEach(tm=>{ const el=document.getElementById('cd-'+tm.id); if(el && !tm.done) el.textContent = clock((tm.end-now)/1000); });
  }
  if(changed && tab==='today') garderVue(()=>{ REFRESH.today(); cartesSync(); });
}
