/* ---------- l'onglet Empire ----------
   Les planètes, leurs jauges et leur vocation, le centre, les niveaux et les
   priorités qu'on y pose, puis les recherches (`VIEWS_EMPIRE`,
   `REFRESH_EMPIRE`).

   Module des vues (issue #49), calé sur l'issue #74. app.js réassemble `VIEWS` et
   `REFRESH` à partir des morceaux de chaque onglet. Ce module emprunte encore
   à app.js le rendu et les calculs qui n'ont pas de module : ce cycle-là est
   toléré tant qu'app.js existe, et rien n'y est lu au chargement. */
import { S } from '../core/etat.js';
import { fmtLigne, fmt, esc, num, costHtml, planetRef } from '../core/format.js';
import {
  B, B_SHORT, T, levelCost, rangeCost, crawlerMax, crawlerBonus
} from '../core/formules.js';
import { IS_EXT } from '../core/serveur.js';
import { dur } from '../core/temps.js';
import {
  centreIndex, centreWhy, labLevel, labEffectif, researchTime, reqOk,
  FOCUS_VAISSEAU
} from '../economie/centre.js';
import { production, mse, NOM_RES, stockNow } from '../economie/production.js';
import { shipList } from '../flotte/vaisseaux.js';
import { lfNom, poseLfCles, lfIds } from '../formes-de-vie/cases.js';
import { LF_PALIER, lfPopNourriture } from '../formes-de-vie/formes-de-vie.js';
import { meteoVoit } from '../meteo.js';
import {
  lvLu, prioCount, prioLvl, poseK, poseVise, poseLignes, poseRien, FOCUS,
  poseNom
} from '../plan/priorites.js';
import { besoinEmpire, VOC_NOM, vocations } from '../plan/vocations.js';
import { REGLES_PAR_ID } from '../regles/moteur.js';
import { fold, cardLayout } from './navigation.js';
import { VIEWS, gauge, REFRESH } from '../../app.js';

/* Les règles qu'on coupe pour une planète seulement — « pas de Terraformeur
   sur mon coffre-fort ». Sur la planète, donc sur ce poste : un id local ne
   voyage pas, comme le modèle de défense par planète. */
function regOffHtml(p){
  const ids = Object.keys(REGLES_PAR_ID).filter(id => REGLES_PAR_ID[id].parPlanete);
  if(!ids.length) return '';
  return `<p class="note mt-2"><b>Règles du moteur</b> — décoche celles qui ne valent pas pour cette planète.</p><div class="row gap-2">${ids.map(id =>
    `<label class="note row gap-1"><input type="checkbox" data-regoff="${esc(p.id)}|${esc(id)}" ${(p.regOff || {})[id] ? '' : 'checked'} class="interrupteur">${esc(REGLES_PAR_ID[id].nom || id)}</label>`).join('')}</div>`;
}

/** Ce que la carte du centre dit sous la case : le risque que le wiki nomme,
    et ce qu'un centre sans labo laisse derrière lui. Vide ailleurs. */
function centreNoteHtml(p, i, ci){
  return i === ci ? `Un espionnage montre où tu bases ta flotte : mets-la à l'abri comme ailleurs.${labLaisse(p)}` : '';
}
/** La vocation d'une planète, en une pastille et sa raison. Rien à dire est
    aussi une information : rien ne distingue cette planète des autres. */
function vocPill(v){
  if(!v) return `<span class="note">${S.planets.length < 2
    ? 'Une seule planète : rien à comparer pour l\'instant.'
    : 'Pas de vocation marquée : son sol ne la distingue d\'aucune autre.'}</span>`;
  const nom = v.keys.length ? v.keys.map(k=>VOC_NOM[k]).join(' et ') : 'Vocation inconnue';
  return `<span class="pill info">${nom}</span>`;
}
/** La raison de la vocation. Elle vit dans le volet des raisons : le joueur
    vient lire une production et poser des objectifs, pas relire pourquoi son
    sol est ce qu'il est — mais il doit pouvoir y revenir. */
function vocRaison(v){ return v && v.why ? `<span class="note">${esc(v.why)}</span>` : ''; }
/** Ce qu'un centre sans labo laisse derrière lui. Le copilote obéit au joueur,
    mais il ne lui cache pas qu'un labo déjà payé ne suivra pas. */
function labLaisse(p){
  const autre = S.planets.filter(x=>x!==p).reduce((a,x)=>(!a || (x.b.lab||0)>(a.b.lab||0)) ? x : a, null);
  if(!autre || (autre.b.lab||0) <= (p.b.lab||0)) return '';
  return ` Le labo ${autre.b.lab} de ${esc(planetRef(autre))} ne suit pas : repartir d'un labo 1 ici coûterait ${fmt(mse(...rangeCost(B.lab, 0, autre.b.lab)))} en équivalent métal.`;
}
/** Les cases de forme de vie dans la grille des niveaux. Elles ne sont pas
    dans B — qui ne porte que des prix fixes, alors que ceux d'une case changent
    d'une espèce à l'autre et s'apprennent au relevé —, d'où leur absence de
    cette grille jusqu'ici. Leur niveau vient du jeu et ne se tape pas : seul
    l'objectif s'écrit, comme pour un bâtiment. */
function lfRows(p){
  return lfIds(p).map(id=>{
    const v = (p.lf || {})[id] || {}, nom = lfNom(p, id);
    return `<label class="f">${esc(nom)}<span class="lv"><input type="number" value="${num(v.lvl)}" readonly tabindex="-1" aria-label="${esc(nom)} : niveau relevé"><input class="prio" type="number" min="${num(v.lvl)+1}" data-pid="${p.id}" data-prio="${id}" data-kind="lf" value="${prioLvl('lf', p.id, id)}" placeholder="→" title="Niveau visé : le plan épargne pour l'atteindre" aria-label="${esc(nom)} : niveau visé"></span></label>`;
  }).join('');
}
/** La carte qui pose le même niveau visé sur plusieurs planètes à la fois.
    Chaque ligne dit ce que la pose ferait avant qu'on clique : le joueur ne
    pose pas en aveugle sur dix planètes, et une planète qui vise déjà plus
    haut le montre plutôt que de se faire écraser sans un mot.
    Repliée par défaut, comme la carte des recherches : elle ne sert que par
    moments, et dépliée elle pousserait l'empire hors de l'écran. */
function poseBloc(){
  const k = poseK(), l = poseLignes(), n = l.filter(x => x.agit).length, vise = poseVise();
  /* Le bouton de retrait n'apparaît que s'il a de quoi faire : sur une case
     vierge, il ne serait qu'un bouton mort de plus à côté de l'autre. */
  const d = l.filter(x => x.retire).length;
  const vies = poseLfCles();
  /* Les formes de vie dans leurs propres groupes, à la suite des bâtiments :
     mêlées à eux elles seraient présentes sans être trouvables — le reproche
     qui leur a déjà valu leur bloc à elles dans la grille des niveaux. */
  const groupe = (titre, cles) => cles.length
    ? `<optgroup label="${esc(titre)}">${cles.map(c => `<option value="${esc(c)}" ${c===k?'selected':''}>${esc(poseNom(c))}</option>`).join('')}</optgroup>` : '';
  const options = Object.keys(B).map(j => `<option value="${j}" ${j===k?'selected':''}>${esc(B[j].n)}</option>`).join('')
    + groupe('Formes de vie · bâtiments', vies.filter(c => c.startsWith('lfbuilding')))
    + groupe('Formes de vie · recherches', vies.filter(c => c.startsWith('lfresearch')));
  /* Une seule pastille par ligne, et elle dit pourquoi. Deux pastilles
     indépendantes — le niveau déjà visé d'un côté, la flèche de l'autre — se
     lisaient comme deux faits séparés, jamais comme « ton 50 va devenir 43 ».
     Tant qu'aucun niveau n'est tapé, pas de pastille du tout : « déjà à 14 »
     sur chaque ligne ne répétait que le nombre d'à côté. */
  const lignes = l.map(x => {
    const etat = !x.coche ? '<span class="note">décochée</span>'
      : !x.ici ? '<span class="note">pas relevée ici</span>'
      : !(vise > 0) ? ''
      : x.agit ? `<b class="mono">→ ${vise}</b>`
      : x.deja != null && x.deja >= vise ? `<span class="note">déjà visé ${x.deja}</span>`
      : `<span class="note">déjà à ${x.actuel}</span>`;
    return `<li><label class="row gap-2"><input type="checkbox" data-posep="${esc(x.pid)}" ${x.coche?'checked':''} class="w-auto">
      <span><b>${esc(x.name)}</b> <span class="note">${esc(x.coords)}</span></span></label>
      <span class="row gap-2"><span class="mono note">${esc(x.quoi || poseNom(k))} ${x.ici ? x.actuel : '—'}</span>${etat}</span></li>`;
  }).join('');
  return `<details class="card"${fold('pose', false)}><summary data-fold="pose">Poser sur toutes les planètes <span class="note">${n} planète${n>1?'s':''}</span></summary>
    <p class="note mt-2">Le même niveau visé sur toutes les planètes cochées, d'un coup. Chaque planète garde ensuite sa priorité à elle : le clic droit dans le jeu la corrige comme avant. Les planètes décochées le restent pour cette case-là.</p>
    <div class="grid mt-2">
      <label class="f">Bâtiment ou forme de vie<select data-pose="k">${options}</select></label>
      <label class="f">Niveau visé<input type="number" min="1" data-pose="lvl" value="${vise > 0 ? vise : ''}" placeholder="43"></label>
    </div>
    <ul class="list mt-2">${lignes}</ul>
    <div class="row mt-2"><button class="btn" data-posego="1" ${n?'':'disabled'}>Poser sur ${n} planète${n>1?'s':''}</button>${
      d ? `<button class="btn ghost" data-posedel="1" title="Enlève le niveau visé de cette case sur les planètes cochées. Le plan cesse d'épargner pour elle ; les niveaux déjà construits ne bougent pas.">Retirer sur ${d} planète${d>1?'s':''}</button>` : ''
    }${(()=>{ const r = poseRien(); return r ? `<span class="note">${esc(r)}</span>` : ''; })()}</div>
  </details>`;
}
/** Les formes de vie sous leur nom, et non mêlées aux bâtiments : posées à la
    suite du Dock et des Satellites, elles étaient présentes sans être
    trouvables. Rien de relevé n'est pas rien à dire non plus — sans cette
    ligne, le joueur cherche dans une grille qui ne les nomme même pas. */
function lfBloc(p){
  const r = lfPopNourriture(p);
  /* Le bouton sur sa propre ligne : au bout d'une phrase longue, au fond d'un
     volet, il ne se voyait pas — c'est exactement le reproche qui a valu son
     cadre au volet lui-même. */
  const bouton = r ? `<div class="row mt-2"><button class="btn sm" data-lfpaliers="${p.id}" title="Pose deux priorités : la nourriture au niveau ${LF_PALIER.nourriture}, puis la population au niveau ${LF_PALIER.population[0]} et enfin ${LF_PALIER.population[1]}. Les niveaux se corrigent ensuite dans les champs.">Poser les paliers de population</button><span class="note">nourriture ${LF_PALIER.nourriture}, population ${LF_PALIER.population[0]} puis ${LF_PALIER.population[1]}</span></div>` : '';
  const titre = `<p class="note mt-2"><b>Formes de vie</b> — niveaux relevés sur la page de ton espèce dans le jeu, à droite le niveau visé.</p>${bouton}`;
  if(!lfIds(p).length) return `<p class="note mt-2"><b>Formes de vie</b> — aucune case de forme de vie relevée ici : ouvre la page de ta forme de vie dans le jeu pour qu'elles apparaissent.</p>`;
  return `${titre}<div class="grid tight mt-2">${lfRows(p)}</div>`;
}
export const VIEWS_EMPIRE = {
empire(){ return cardLayout('empire', {planetes: VIEWS.planets(), recherche: VIEWS.research()}); },
planets(){
  return `<section class="panel">
    ${S.sample ? `<div class="example">Données d'exemple : remplace-les par tes niveaux réels (planète mère, mine de métal 1). Les cases se sauvegardent dans ce navigateur.</div>` : ''}
    <div class="card"><div class="row spread"><h2>Empire · production / heure</h2><span id="empireFactor"></span></div><div class="res" id="empireRes"></div><details class="volet"${fold('mix', false)}><summary data-fold="mix">Pourquoi ce classement</summary><p class="note mt-2" id="empireMix"></p></details></div>
    ${poseBloc()}
    ${(()=>{ const voc = vocations(), ci = centreIndex(), auto = centreIndex(true); return S.planets.map((p,i)=>`
    <details class="card ligne" data-pi="${i}"${fold('pl:' + p.id, false)}${meteoVoit(p.id) ? '' : ' hidden'}>
      <summary data-fold="pl:${p.id}" class="plsum"><b>${esc(p.name)}</b> <span class="note">${esc(p.coords)}</span><span class="mono" id="psum-${i}"></span></summary>
      <div class="planet-head">
        <input id="pn-${p.id}" data-p="name" value="${esc(p.name)}" aria-label="Nom de la planète">
        <input id="pc-${p.id}" class="coords" data-p="coords" value="${esc(p.coords)}" aria-label="Coordonnées" placeholder="1:1:8">
        <input id="pt-${p.id}" class="temp" type="number" data-p="tmax" value="${num(p.tmax)}" aria-label="Température max (°C)" title="Température max en °C (vue d'ensemble)">
        <span class="note">°C max</span>
        ${S.planets.length>1?`<button class="btn sm ghost" data-del="${i}">Retirer</button>`:''}
      </div>
      <div class="res" id="pres-${i}"></div>
      <div class="row gap-2"><span class="voc" id="pvoc-${i}">${vocPill(voc[p.id])}</span>${ci<0
        ? `<span class="note">${FOCUS_VAISSEAU[S.day.focus]
            ? `${esc(FOCUS[S.day.focus])} : pas de centre, tes planètes doivent rester dispersées.`
            : 'Un centre se choisit entre plusieurs planètes.'}</span>`
        : `<label class="f coche"><input id="pcentre-${p.id}" type="checkbox" data-centre="${p.id}" ${i===ci?'checked':''} class="interrupteur"> Centre${auto===i?' (conseillé)':''}</label>`}</div>
      <p class="note" id="pfleet-${i}"></p>
      <details class="volet" id="pq-${i}"${fold('pq:' + p.id, false)}><summary data-fold="pq:${p.id}">Pourquoi cette planète</summary>
      <div class="col-notes mt-2">
        <span id="pvocw-${i}">${vocRaison(voc[p.id])}</span>
        ${ci>=0&&i===ci&&centreWhy()?`<p class="note">${esc(centreWhy())}</p>`:''}
        <p class="note" id="pctrn-${i}">${centreNoteHtml(p, i, ci)}</p>
      </div>
      </details>
      <details class="volet"${fold('niv:' + p.id, false)}><summary data-fold="niv:${p.id}">Bâtiments et niveaux visés <span class="note" id="pobj-${i}"></span></summary>
      <div class="grid tight mt-2">
        ${Object.keys(B).map(k=>`<label class="f">${B_SHORT[k]}<span class="lv"><input id="pb-${p.id}-${k}" type="number" min="0" data-b="${k}" value="${num(p.b[k])}"${lvLu(p) ? ' readonly tabindex="-1"' : ''}><input class="prio" type="number" min="${num(p.b[k])+1}" data-pid="${p.id}" data-prio="${k}" value="${prioLvl('b', p.id, k)}" placeholder="→" title="Niveau visé : le plan épargne pour l'atteindre" aria-label="${B_SHORT[k]} : niveau visé"></span></label>`).join('')}
        <label class="f">Satellites<input id="ps-${p.id}" type="number" min="0" data-p="sats" value="${num(p.sats)}"${lvLu(p) ? ' readonly tabindex="-1"' : ''}></label>
        <label class="f">Satellites autorisés<select data-satsok="${p.id}"><option value="">Hériter (${S.settings.sats ? 'oui' : 'non'})</option><option value="1" ${p.satsOk === true ? 'selected' : ''}>Oui</option><option value="0" ${p.satsOk === false ? 'selected' : ''}>Non</option></select></label>
      </div>
      ${lfBloc(p)}
      ${regOffHtml(p)}
      </details>
      <details class="volet"${fold('stock:' + p.id, false)}><summary data-fold="stock:${p.id}">Stock <span class="mono note" id="pstk-${i}"></span></summary>
      <p class="note mt-2">Ce que cette planète a en magasin. Il avance tout seul avec ta production ; recale-le quand tu dépenses.</p>
      <div class="grid tight mt-2">
          <label class="f">Métal<input id="sm-${p.id}" type="number" data-s="m" value="${Math.round(stockNow(p)[0])}"></label>
          <label class="f">Cristal<input id="sc-${p.id}" type="number" data-s="c" value="${Math.round(stockNow(p)[1])}"></label>
          <label class="f">Deutérium<input id="sd-${p.id}" type="number" data-s="d" value="${Math.round(stockNow(p)[2])}"></label>
      </div>
      </details>
    </details>`).join(''); })()}
    <div class="row"><button class="btn" id="addPlanet">Ajouter une colonie</button>
    <span class="note" id="colonyNote"></span></div>
  </section>`;
},
research(){
  return `<details class="card"${fold('recherches', false)}><summary data-fold="recherches">Recherches et niveaux visés <span class="note">labo niveau <b id="labLv"></b></span></summary>
    <div class="tbl-wrap"><table class="tech"><thead><tr><th>Technologie</th><th class="n">Niv.</th><th class="n">Visé</th><th>Coût prochain niv.</th><th class="n">Durée</th><th>État</th></tr></thead><tbody>
    ${Object.keys(T).map(k=>`<tr><td>${T[k].n}</td><td class="n"><input id="t-${k}" type="number" min="0" data-t="${k}" value="${num(S.tech[k])}"></td><td class="n"><input class="prio" type="number" min="${num(S.tech[k])+1}" data-prio="${k}" value="${prioLvl('t', null, k)}" placeholder="→" title="Niveau visé : le plan épargne pour l'atteindre" aria-label="${T[k].n} : niveau visé"></td><td id="tc-${k}"></td><td class="n" id="tt-${k}"></td><td id="ts-${k}"></td></tr>`).join('')}
    </tbody></table></div>
  </details>`;
},
};
function factorPill(f){ return f>=1 ? `<span class="pill good">Énergie OK</span>` : `<span class="pill ${f<.8?'bad':'warn'}">Rendement ${Math.round(f*100)} %</span>`; }
/* Les foreuses sont invisibles dans le jeu une fois posées : cette pastille est
   le seul endroit qui dise combien en profitent encore, et ce qu'elles ajoutent.
   La surcharge se lit sur la planète quand elle y est connue, comme le fait
   production() — sinon le pourcentage contredirait les jauges d'à côté. */
function crawlerPill(p){
  const max = crawlerMax(p.b.metal, p.b.crystal, p.b.deut); if(!max) return '';
  const have = p.crawlers||0, over = p.overload != null ? p.overload : S.settings.crawlerOverload;
  const pct = (crawlerBonus(Math.min(have,max), S.settings.cls, over)*100).toFixed(1).replace('.',',');
  return `<div class="wide"><span class="pill ${have>=max?'good':'info'}">Foreuses ${fmt(have)} / ${fmt(max)} utiles · +${pct} %</span></div>`;
}
export const REFRESH_EMPIRE = {
empire(){ REFRESH.planets(); REFRESH.research(); },
planets(){
  let tm=0,tc=0,td=0, worst=1;
  const voc = vocations(), ci = centreIndex();
  S.planets.forEach((p,i)=>{
    const pr=production(p); tm+=pr.m; tc+=pr.c; td+=pr.d; worst=Math.min(worst,pr.factor);
    const st=stockNow(p), full = i2 => { const r=[pr.m,pr.c,pr.d][i2]; return r>0 && st[i2]<pr.cap[i2] ? `plein dans ${dur((pr.cap[i2]-st[i2])/r*3600)}` : (st[i2]>=pr.cap[i2]?'hangar plein':''); };
    document.getElementById('pres-'+i).innerHTML =
      gauge('m','m','Métal',fmt(pr.m),full(0)) + gauge('c','c','Cristal',fmt(pr.c),full(1)) + gauge('d','d','Deutérium',fmt(pr.d),full(2)) +
      gauge('e','e','Énergie',(pr.eBal>=0?'+':'')+fmt(pr.eBal), `${fmt(pr.eProd)} produits / ${fmt(pr.eCons)}${p.eAdj<0?` · dont ${fmt(p.eAdj)} formes de vie`:''}`) +
      crawlerPill(p);
    /* Les trois chiffres dans le résumé : c'est ce qu'on vient lire, et la
       carte reste fermée pour le lire. */
    const ps = document.getElementById('psum-'+i); if(ps) ps.innerHTML = [pr.m, pr.c, pr.d].map(fmtLigne).join(' · ');
    /* Le stock ne se lit en chiffres nulle part ailleurs — les jauges au-dessus
       disent la production. Son résumé le rend lisible sans ouvrir le volet,
       qui ne sert qu'à le recaler. */
    const pk = document.getElementById('pstk-'+i); if(pk) pk.innerHTML = st.map(fmtLigne).join(' · ');
    const fl = document.getElementById('pfleet-'+i); if(fl){ const l = shipList(p.ships); fl.innerHTML = l ? `<b>Flotte à quai :</b> ${esc(l)}` : (IS_EXT ? 'Flotte inconnue : ouvre la page Flotte du jeu sur cette planète.' : ''); }
    /* La vocation et la note du centre suivent les coordonnées, la température
       et les niveaux qu'on tape dans la carte : sans ça elles restaient
       périmées jusqu'au prochain rendu complet. On ne réécrit que du texte —
       la case du centre garde son écouteur, qu'un innerHTML emporterait. */
    const vq = document.getElementById('pvoc-'+i); if(vq) vq.innerHTML = vocPill(voc[p.id]);
    const vw = document.getElementById('pvocw-'+i); if(vw) vw.innerHTML = vocRaison(voc[p.id]);
    const nb = prioCount(p.id);
    const po = document.getElementById('pobj-'+i); if(po) po.textContent = nb ? `${nb} priorité${nb > 1 ? 's' : ''}` : '';
    /* Un volet qui promet une explication et s'ouvre sur du vide est du bruit
       de plus, pas de moins. Il se cache quand les trois raisons sont muettes. */
    const pq = document.getElementById('pq-'+i);
    if(pq) pq.hidden = !(vocRaison(voc[p.id]) || (i === ci && centreWhy()) || centreNoteHtml(p, i, ci));
    const cn = document.getElementById('pctrn-'+i); if(cn) cn.innerHTML = centreNoteHtml(p, i, ci);
  });
  document.getElementById('empireRes').innerHTML = gauge('m','m','Métal',fmt(tm),fmt(tm*24)+' / jour')+gauge('c','c','Cristal',fmt(tc),fmt(tc*24)+' / jour')+gauge('d','d','Deutérium',fmt(td),fmt(td*24)+' / jour')+gauge('e','e','Planètes',S.planets.length,`max ${1+Math.ceil(S.tech.astro/2)} (Astro ${S.tech.astro})`);
  document.getElementById('empireFactor').innerHTML = factorPill(worst);
  /* Le mélange, en clair : c'est lui qui décide quelle mine passe devant, et
     tant qu'il ne se lisait nulle part le classement avait l'air arbitraire. */
  const mix = document.getElementById('empireMix');
  if(mix){
    const w = besoinEmpire(), r = S.settings.ratio, som = r[0]+r[1]+r[2];
    const tot = Math.max(0,tm)+Math.max(0,tc)+Math.max(0,td);
    const part = tot > 0 ? [tm,tc,td].map(x=>Math.round(Math.max(0,x)/tot*100)) : null;
    mix.innerHTML = part
      ? `Mélange produit <b>${part.join(' / ')} %</b> de métal / cristal / deutérium, pour une cible de <b>${[0,1,2].map(i=>Math.round(r[i]/som*100)).join(' / ')} %</b> — ton ratio d'échange ${r.join(':')} lu comme des quantités. Le classement des mines en tient compte : ${[0,1,2].map(i=>`${NOM_RES[i]} ×${w[i].toFixed(2)}`).join(', ')}. Un facteur sous 1 veut dire que tu en produis déjà plus que ta part, donc qu'un niveau de plus vaut moins qu'au cours.`
      : 'Aucune production : rien à mélanger pour l\'instant.';
  }
  document.getElementById('colonyNote').textContent = S.tech.astro ? '' : 'Les colonies demandent Astrophysique 1.';
},
research(){
  /* Le labo de la planète, et ce que le Réseau en fait quand il y en a un :
     c'est le premier qui débloque, le second qui donne les durées de la
     colonne d'à côté. Les afficher ensemble évite de lire l'un pour l'autre. */
  const lv = labLevel(), eff = labEffectif();
  document.getElementById('labLv').textContent = eff > lv ? `${lv} · réseau ${eff}` : lv;
  for(const k of Object.keys(T)){
    const L=S.tech[k]+1, miss=reqOk(T[k].req, null);
    document.getElementById('tc-'+k).innerHTML = costHtml(levelCost(T[k],L));
    document.getElementById('tt-'+k).textContent = dur(researchTime(k,L));
    document.getElementById('ts-'+k).innerHTML = miss.length?`<span class="pill bad">${miss.join(', ')}</span>`:`<span class="pill good">disponible</span>`;
  }
},
};
