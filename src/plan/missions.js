/* ---------- les missions du jour ----------
   Les missions proposées au joueur (`dailyMissions`) et ce qui les marque
   faites ou refusées (`missionKey`, `missionDone`, `noLabel`), avec les
   options d'énergie qu'elles proposent (`energyOptions`).

   Module du plan du jour (issue #49). Le rendu (`noListe`, `noBtn`,
   `expoHtml`…) reste dans app.js jusqu'à l'étape des vues. Ce module
   emprunte encore à app.js ce qu'il affiche et lit : ce cycle-là est toléré
   tant qu'app.js existe, et rien n'y est lu au chargement. */
import { S } from '../core/etat.js';
import { coutTexte, fmt, esc, planetRef } from '../core/format.js';
import { B, T, levelCost, rangeCost, SAT_COST } from '../core/formules.js';
import { IS_EXT, API } from '../core/serveur.js';
import { dur, formatTime } from '../core/temps.js';
import { DEF, defMixList } from '../defense/defense.js';
import { flotteCible, reequilibreCartes, flotteAjout } from '../flotte/cible.js';
import { expoFleet, expoCap, astroForExpo, expoWanted } from '../flotte/expeditions.js';
import {
  SHIPS, parseC, shipStats, flight, shipList, planeteEn, fleetSlots,
  flotteEnVol
} from '../flotte/vaisseaux.js';
import {
  lfBloquee, lfCandidates, LIFEFORMS, speciesOfPlanet, foundLifeforms,
  lfPourPos, lfRaisonPos, lfConseilPlanete
} from '../formes-de-vie/formes-de-vie.js';
import { astroForPlanet, nextResearch, chantierARelire, satsOk, cardKey } from './journee.js';
import { poseHeure, heureTxt, isNight, nightLen, absenceJour, wakeTime } from './nuit.js';
import {
  pickCargo, FS_MISSION, FS_MISSION_N, partAbri, fleetsavePlan,
  cargoGaps, secu, prochaineHeure
} from '../securite/securite.js';
import {
  save, planetById, lfNom, coordLink, leverFlotte, labPlanet, production,
  mse, stockNow, reqOk, debordeTexte, colSentNow, maxPlanets, coloTarget,
  coloPaybackTxt, lfMode, occupied, colonyCandidates, raidTargets,
  raidPlan, poidsCat, catMission
} from '../../app.js';
/**
 * Les sources d'énergie posables sur cette planète, chiffrées, de la moins
 * chère à la plus chère par point d'énergie.
 *
 * Le gain se lit sur `production` plutôt que sur la formule : les bonus de
 * classe et d'officier, l'écart calé sur le panneau du jeu (`eAdj`) et le
 * forfait de forme de vie s'appliquent à la production d'énergie entière, et un
 * gain calculé à part les aurait tous oubliés.
 *
 * `prete` dit si l'option est proposable — la fusion demande ses prérequis, les
 * satellites un chantier spatial et l'accord du joueur. Une option écartée
 * reste dans la liste avec sa raison : c'est elle qui permet de dire « les
 * satellites auraient coûté moins cher » sans pour autant les proposer.
 * @param {object} p planète de S.planets
 * @returns {{kind:string, label:string, cost:number[], gain:number,
 *   perPoint:number, note:string, prete:boolean, pourquoiPas:string}[]}
 */
export function energyOptions(p){
  const base = production(p), manque = Math.max(0, base.eCons - base.eProd), out = [];
  const add = o => { if(o.gain > 0) out.push(Object.assign({note:'', prete:true, pourquoiPas:'', perPoint: mse(...o.cost)/o.gain}, o)); };
  /* Chaque option est dimensionnée sur ce qui manque. Comparer « un niveau de
     centrale » à « huit satellites » ne dirait rien : la moins chère au point
     serait toujours celle qui monte le moins — un niveau de fusion qui rend
     trente d'énergie quand il en manque deux cent cinquante. Sans manque, un
     pas de un, qui est la question que pose alors le joueur : « et si j'en
     montais une ? »  Même borne que `rankUpgrades`. */
  const palier = (k, def) => {
    const de = p.b[k] || 0;
    for(let n = 1; n <= 15; n++){
      const gain = production(p, {[k]: de + n}).eProd - base.eProd;
      if(gain >= manque || n === 15) return {lvl: de + n, n, gain, cost: rangeCost(def, de, de + n)};
    }
  };
  const sol = palier('solar', B.solar);
  add({kind:'solar', label:`Centrale solaire ${sol.lvl}`, cost:sol.cost, gain:sol.gain,
       note: sol.n > 1 ? `${sol.n} niveaux à monter` : ''});
  /* La fusion brûle du deutérium tous les jours : le dire fait partie du prix,
     et `production` le retranche déjà de la production de la planète. */
  const fus = palier('fusion', B.fusion), fusMiss = reqOk(B.fusion.req, p);
  const brule = base.d - production(p, {fusion:fus.lvl}).d;
  add({kind:'fusion', label:`Centrale de fusion ${fus.lvl}`, cost:fus.cost, gain:fus.gain,
       note:[fus.n > 1 ? `${fus.n} niveaux à monter` : '', `brûle ${fmt(brule)} de deutérium par heure`].filter(Boolean).join(', '),
       prete: !fusMiss.length, pourquoiPas: fusMiss.length ? `il manque ${fusMiss.join(', ')}` : ''});
  /* Un satellite de plus se simule sur une copie : `production` lit `p.sats`,
     pas les surcharges de niveaux. */
  const avec = n => production(Object.assign({}, p, {sats:(p.sats||0)+n})).eProd - base.eProd;
  const un = avec(1);
  if(un > 0){
    const n = Math.max(1, Math.ceil(manque / un));
    add({kind:'sats', label:`${n} satellite${n>1?'s':''} solaire${n>1?'s':''}`, cost:SAT_COST.map(x=>x*n),
         gain: avec(n), note:`${un} d'énergie par satellite à ${p.tmax} °C`,
         prete: satsOk(p) && p.b.shipyard >= 1,
         pourquoiPas: !satsOk(p) ? 'tu ne les autorises pas (Réglages › Énergie)' : 'il manque Chantier spatial 1'});
  }
  return out.sort((a,b)=>a.perPoint-b.perPoint);
}
/** Une option d'énergie en clair : son prix, et ce qu'elle rapporte. */
export function energyLine(o){
  return `${o.label} (${coutTexte(o.cost)}, +${Math.round(o.gain)} d'énergie${o.note ? `, ${o.note}` : ''})`;
}

/** Context-aware to-do items that sit outside the build and research queues. */
export function dailyMissions(){
  const now = Date.now(), out = [], h = new Date(now).getHours();
  const target = coloTarget(), lfCible = c => LIFEFORMS[lfPourPos((parseC(c)||[])[2]||0)].n;
  const colMove = (S.moves||[]).find(m=>m.mission===7 && !m.ret && m.arrival*1000>now);
  if(colMove) out.push({id:'colo-fly', info:true, q:'Colonie', every:24, sev:'info', what:`Colonisation en route vers ${colMove.dest||coloTarget()}`, why:`Arrivée vers ${formatTime(colMove.arrival*1000)}. Prépare le kit et la forme de vie ${lfCible(colMove.dest||target)}.`, how:['Garde des transporteurs libres pour le kit.', 'À l\'arrivée, relève le nombre de cases et saisis-le dans Outils › Colonie.']});
  if(!colMove && S.colo.sentAt && now - S.colo.sentAt < 12*3600e3 && !S.colo.fields){
    out.push({id:'colo-eval', q:'Colonie', every:24, sev:'warn', what:'Évaluer ta nouvelle colonie', why:'Dès son arrivée, vérifie sa taille avant d\'y construire quoi que ce soit.',
      how:['Vue d\'ensemble de la colonie : relève le nombre de cases.', 'Outils › Colonie › Après l\'arrivée : saisis-le pour savoir si tu la gardes.', `Choisis la forme de vie ${lfCible(target)} — ${lfRaisonPos((parseC(target)||[])[2]||0)}. Puis envoie les transporteurs du kit (mission Transporter).`]});
  }
  const fs = fleetSlots();
  if(fs && fs[0]>=fs[1]) out.push({id:'fleetslots', info:true, q:'Flotte', every:3, sev:'warn', what:`Emplacements de flotte pleins (${fs[0]}/${fs[1]})`, why:'Chaque mission en vol (découvertes comprises) prend un emplacement. Aucune expédition possible avant un retour.', how:['Attends le premier retour (Mouvements de flotte).', 'Garde 1 emplacement libre pour les expéditions : envoie un peu moins de découvertes à la fois.', `Technologie Ordinateur ${S.tech.computer+1} ajoute un emplacement.`]});
  const nExp = expoCap(), veut = expoWanted();
  /* D'où vient le plafond, en clair : lu sur la page de flotte, ou déduit
     d'Astrophysique faute de l'avoir lue. Sans ça, les deux cas donnent la même
     carte et « rien n'a changé » est indécidable. */
  /* L'heure de la lecture, et pas seulement le chiffre : il ne vaut que trois
     heures, et le joueur doit pouvoir juger si celui-ci est encore d'actualité. */
  const sExp = S.slots && S.slots.expo
    ? `lu dans le jeu à ${formatTime(S.slots.at || S.syncAt)} : ${S.slots.expo[0]}/${S.slots.expo[1]}` : null;
  const sFl = fs ? `emplacements de flotte ${fs[0]}/${fs[1]}` : null;
  const source = sExp ? ` (${[sExp, sFl].filter(Boolean).join(`, `)})` : ` (déduit d'Astrophysique ${S.tech.astro} : la page de flotte n'a pas encore été lue)`;
  const flottes = S.planets.map(p=>expoFleet(Object.assign({}, p.ships), p)).filter(Boolean);
  /* Une expédition ne rapporte jamais plus que la soute envoyée. Quand toutes
     les flottes sont loin de ce plafond, un emplacement de plus ne rapporte
     rien : réclamer Astrophysique enverrait dépenser pour rien. Ce sont des
     transporteurs qu'il manque. */
  if(veut <= nExp && nExp >= 1 && flottes.length && flottes.every(f=>f.cargo < f.cap*0.7)){
    const best = flottes.reduce((a,f)=>f.cargo>a.cargo?f:a);
    const manque = Math.ceil((best.cap-best.cargo)/shipStats('lc').cargoEff);
    out.push({id:'expocargo', info:true, q:'Exploration', every:24, sev:'warn',
      what:`Tes expéditions partent à ${Math.round(best.cargo/best.cap*100)} % de leur soute utile`,
      why:`Une expédition ne rapporte jamais plus que la soute envoyée : ${fmt(best.cargo)} embarqués pour ${fmt(best.cap)} ramenables. Un emplacement de plus n'y changerait rien — des transporteurs, si.`,
      how:[`Chantier spatial : environ ${manque} grands transporteurs de plus pour saturer une expédition.`,
        `Astrophysique n'ajoute un emplacement qu'au niveau ${astroForExpo()} : inutile tant que les soutes repartent à moitié vides.`,
        'Les transporteurs servent aussi au rapatriement et à la mise à l'+"'"+'abri du soir.']});
  }
  /* Le plafond des planètes, là où le joueur lit son plan. Le conseil de l'onglet
     Suivi le disait déjà, mais personne ne va l'y chercher — et une colonie vaut
     plus que n'importe quelle recherche de la feuille de route. */
  if(S.tech.astro && S.planets.length >= maxPlanets()){
    const need = astroForPlanet(), c = rangeCost(T.astro, S.tech.astro, need);
    out.push({id:'colomax', info:true, q:'Colonie', every:24, sev:'warn',
      what:`Plafond atteint : ${maxPlanets()} planètes`,
      why:`Astrophysique ${need} en autoriserait une ${maxPlanets()+1}ᵉ, pour ${fmt(c[0])} métal, ${fmt(c[1])} cristal et ${fmt(c[2])} deutérium. Une colonie ajoute une production complète : aucune recherche ne rapporte autant. ${coloPaybackTxt()}`,
      how:[`Recherche : Astrophysique ${S.tech.astro+1}${need>S.tech.astro+1 ? ` (le palier utile est ${need})` : ''}.`,
        'Puis prépare la colonie dans l\'onglet Cibles › Colonie : position, vaisseaux et ressources à emporter.',
        S.day.focus==='eco' ? 'En « Économie pure » le plan ne colonise pas de lui-même : passe en « Économie + colonie » pour qu\'il s\'en charge.' : 'Le plan construira le vaisseau de colonisation de lui-même.']});
  }
  if(veut > nExp) out.push({id:'expomax', info:true, q:'Exploration', every:12, sev:'warn',
    what:`Plafond atteint : ${nExp} expédition${nExp>1?'s':''} à la fois`,
    why:`Ta flotte au sol en remplirait au moins ${veut}. Le nombre d'expéditions simultanées ne dépend que d'Astrophysique : ${nExp+1} à partir du niveau ${astroForExpo()}.${source}`,
    how:[`Recherche : Astrophysique ${S.tech.astro+1}${astroForExpo()>S.tech.astro+1 ? ` (le palier utile est ${astroForExpo()})` : ''}.`,
      `Astrophysique ${astroForPlanet()} ajouterait aussi un emplacement de colonie.`,
      'En attendant, les transporteurs en trop servent au rapatriement ou à la mise à l'+"'"+'abri du soir.']});
  /* Le taux 3:2:1 sert déjà de pondération partout ; il sert aussi à échanger.
     Quand une seule ressource retient la prochaine recherche et qu'une autre
     dort en quantité, le Marchand débloque la file sans attendre la production. */
  const NOMS_RES = ['métal', 'cristal', 'deutérium'];
  const nr0 = nextResearch(), labP0 = labPlanet();
  if(nr0.k && labP0 && !nr0.labNeed){
    const c = levelCost(T[nr0.k], nr0.lvl), st = stockNow(labP0), r = S.settings.ratio;
    const manque = [0,1,2].filter(j=>c[j] > st[j]);
    if(manque.length === 1){
      const j = manque[0], besoin = c[j] - st[j];
      // Ce qu'il faudrait céder d'une autre ressource, au taux réglé.
      const source = [0,1,2].filter(k=>k!==j && st[k] - (c[k]||0) > 0)
        .map(k=>({k, donne: besoin * r[k] / r[j], reste: st[k] - (c[k]||0)}))
        .filter(x=>x.reste >= x.donne).sort((a,b)=>b.reste-a.reste)[0];
      if(source) out.push({id:'merchant', info:true, q:'Marchand', every:6, sev:'good',
        what:`Échanger du ${NOMS_RES[source.k]} contre du ${NOMS_RES[j]} pour lancer ${T[nr0.k].n} ${nr0.lvl}`,
        why:`Il manque ${fmt(besoin)} de ${NOMS_RES[j]} sur ${labP0.name}, et ${fmt(source.reste)} de ${NOMS_RES[source.k]} y dorment. Au taux ${r.join(':')}, ${fmt(source.donne)} suffisent.`,
        how:['Marchand › Échange de ressources : choisis la ressource à céder, puis celle à recevoir.',
          'Le taux du Marchand dépend de ton antimatière : vérifie qu\'il reste proche de ton taux réglé avant de valider.',
          'Sans antimatière, fais venir la ressource manquante depuis une colonie.']});
    }
  }
  /* Une découverte prend un emplacement de flotte comme n'importe quelle autre
     mission. Tous pris, le bouton Découverte de la Galaxie est gris et dit
     « Nombre maximal de flottes atteint » : proposer la carte quand même, c'est
     envoyer le joueur cliquer sur rien. La carte des emplacements pleins, elle,
     sort déjà plus haut et explique quoi faire. */
  if(!(fs && fs[0] >= fs[1])){
    /* Les quatre races trouvées, il n'y a plus rien à découvrir de ce côté :
       promettre « de nouvelles races » et renvoyer vers les cases à cocher,
       c'est faire cliquer pour rien celui qui a déjà tout. Restent les
       artefacts, qui font tourner les technologies de forme de vie. */
    const trouvees = foundLifeforms(), toutes = trouvees.length === Object.keys(LIFEFORMS).length;
    out.push({id:'discovery', q:'Exploration', every:24, sev:'info', what:'Missions de découverte (formes de vie)', why:`${toutes ? 'Tu as les quatre races : elles ne rapportent plus que des artefacts.' : 'Elles rapportent des artefacts et de nouvelles races.'} Chacune occupe un emplacement de flotte jusqu'à son retour.${fs?` Il t'en reste ${fs[1]-fs[0]} sur ${fs[1]}.`:''}${toutes?'':` Trouvées : ${trouvees.map(k=>LIFEFORMS[k].n).join(', ')}.`}${S.artefacts!=null?` Artefacts : ${fmt(S.artefacts)}.`:''}`,
      how:['Galaxie : bouton <b>Découverte</b> en haut, ou icône ADN violette sur une ligne.', 'Fais-en sur plusieurs systèmes : le nombre par jour est limité.', 'Garde un emplacement libre pour tes expéditions : elles rapportent plus.']
        .concat(toutes ? [] : ['Une race trouvée qui n\'est pas encore lue sur tes planètes ? Coche-la dans Réglages › Formes de vie pour que Copilote en tienne compte.'])
        // Un seul emplacement libre : la prochaine découverte bloque les expéditions.
        .concat(fs && fs[1]-fs[0] <= 1 ? [leverFlotte()] : [])});
  }
  /* Choisir la technologie d'un slot, c'est lancer la recherche de forme de
     vie qui va avec : toutes les files occupées, le jeu n'en prend pas une de
     plus. Le copilote le sait, il vient d'en lancer une. Aucune case de
     recherche lue nulle part : on ne sait rien, la carte sort comme avant. */
  const lfrP = S.planets.filter(p=>Object.keys(p.lf||{}).some(id=>lfQueue(id)==='lfresearch'));
  const lfrLibre = !lfrP.length || lfrP.some(p=>!(S.timers||[]).some(t=>t.queue==='lfresearch' && t.pid===p.id && !t.done && t.end>now));
  /* Une semaine, et non un jour : le copilote ne sait pas lire quels slots de
     palier sont déjà choisis, donc il ne peut que proposer — et proposer tous
     les jours ce qui est fait une fois pour toutes, c'est du bruit. */
  if(lfrLibre && S.artefacts!=null && S.artefacts>=200) out.push({id:'artefacts', q:'Formes de vie', every:24*7, sev:'good', what:`${fmt(S.artefacts)} artefacts : choisis une technologie de forme de vie`, why:'Au palier 1, 200 artefacts permettent de choisir précisément la technologie d\'un slot au lieu du tirage aléatoire.', how:['Forme de vie › Recherche : sur un slot libre, choisis la technologie voulue.', 'Attention : changer un slot déjà pris oblige à réinitialiser tout le palier.']});
  if(IS_EXT && S.syncAt && now - S.syncAt < 3600e3){
    // Trois situations, trois messages : page jamais ouverte, page lue mais
    // aucun prix affiché, ou tout est su — et alors c'est le plan qui parle.
    // Un prix ne s'obtient qu'en ouvrant une case : le jeu ne l'affiche pas
    // dans la liste.
    const lfState = (p, q) => {
      const cases = Object.entries(p.lf || {}).filter(([id])=>lfQueue(id)===q);
      /* Page jamais ouverte : rien de lu, donc rien de su. Page des bâtiments
         ouverte et pourtant vide : le jeu y montre les douze cases dès qu'une
         espèce habite la planète, niveau 0 compris — aucune ne sort, donc la
         planète n'a pas encore d'espèce, et c'est elle qu'il faut choisir
         avant tout le reste. La page des recherches, elle, reste vide tant que
         le bâtiment qui ouvre l'arbre manque : là, il n'y a rien à dire. */
      if(!cases.length){
        if(!(p.lfSeen||{})[q]) return {need:'page', n:0};
        return {need: q === 'lfbuilding' && !speciesOfPlanet(p) ? 'race' : null, n:0};
      }
      const libres = cases.filter(([,v])=>!lfBloquee(v));
      if(lfCandidates(p, q).length) return {need:null, n:cases.length};
      return {need: libres.length ? 'prix' : null, n:cases.length};
    };
    const lfCard = (q, id, quoi, page) => {
      if(lfMode()==='off') return;
      /* Une file de recherche ne s'ouvre qu'une fois l'espèce posée et son
         bâtiment d'arbre construit. La réclamer sur une planète dont aucune
         case de bâtiment n'est lue envoyait le joueur sur une page vide — et,
         sur une colonie neuve, doublait la carte qui lui demande déjà de
         choisir son espèce. */
      const vus = S.planets.map(p=>({p, st:lfState(p,q)}))
        .filter(x=>x.st.need && (q!=='lfresearch' || Object.keys(x.p.lf||{}).some(i=>lfQueue(i)==='lfbuilding')));
      if(!vus.length) return;
      const race = vus.filter(x=>x.st.need==='race');
      const page0 = vus.filter(x=>x.st.need==='page').map(x=>planetRef(x.p));
      const prix = vus.filter(x=>x.st.need==='prix');
      /* Au-delà de deux planètes, le titre nommerait chaque espèce sur trois
         lignes : le détail est déjà dans le pourquoi, planète par planète. */
      const quoiFaire = race.length
        ? (race.length > 2
          ? `Choisis la forme de vie de ${race.length} planètes.`
          : `Choisis la forme de vie de ${race.map(x=>`${planetRef(x.p)} : ${lfConseilPlanete(x.p).n}`).join(' · ')}.`)
        : page0.length
        ? `Ouvre ${page} sur ${page0.join(', ')}, puis clique une case.`
        : `Clique une case ${quoi} sur ${prix.map(x=>planetRef(x.p)).join(', ')}.`;
      const etat = x => x.st.need==='race' ? `aucune espèce posée — ${lfConseilPlanete(x.p).why}, donc ${lfConseilPlanete(x.p).n}`
        : x.st.n ? `${x.st.n} case${x.st.n>1?'s':''} lue${x.st.n>1?'s':''}, aucun prix`
        : 'page jamais ouverte';
      out.push({id, q:'Formes de vie', every:12, sev:'info', tags:vus.map(x=>planetRef(x.p)),
        what:quoiFaire,
        why:`${vus.map(x=>`${planetRef(x.p)} : ${etat(x)}`).join(' · ')}. ${race.length
          ? 'Une recherche de forme de vie vaut pour tout l\'empire, un bâtiment seulement pour sa planète : une colonie porte l\'espèce qui sert sa production à elle.'
          : 'Le prix n\'apparaît qu\'en ouvrant une case ; sans lui le copilote ne sait pas quand tu pourras la payer.'}`,
        how:race.length ? [
          'Forme de vie › Bâtiments sur cette planète : choisis l\'espèce, puis clique une case pour que le copilote lise son prix.',
          'Changer d\'espèce plus tard coûte deux jours d\'attente et les bâtiments déjà posés : c\'est un choix qu\'on fait une fois.',
          'Tu comptes en faire ta base d\'expéditions, ou y tenter une lune ? Kaeleshs plutôt : eux seuls augmentent les deux.'
        ] : [
          'Ouvre la page sur cette planète, puis clique une case.',
          'Si elle n\'a pas encore d\'espèce, le jeu te la fait choisir là : le copilote dira laquelle dès qu\'il aura vu la page.',
          'Le copilote lit le niveau, le prix et la durée affichés par le jeu.',
          'Ensuite elle entre dans le plan comme une mine, avec le « il manque » et l\'heure.']});
    };
    lfCard('lfbuilding', 'lfb', 'de bâtiment', 'les bâtiments de forme de vie');
    lfCard('lfresearch', 'lfr', 'de recherche', 'les recherches de forme de vie');
  }
  /* Tant que la page Défense n'a pas été ouverte une fois, def vaut null et le
     copilote ignore ce qui protège la planète : il ne peut ni compléter la
     défense sans doubler ce qui existe, ni trancher entre satellites et
     centrale. Un clic contre un raid. */
  const aveugles = S.planets.filter(p=>p.def == null && p.b.shipyard>=1);
  if(aveugles.length) out.push({id:'defseen', q:'Sécurité', every:24, sev:'warn',
    what:aveugles.length>1 ? `Ouvrir la page Défense (${aveugles.length} planètes)` : `Ouvrir la page Défense sur ${planetRef(aveugles[0])}`,
    why:`Sans elle, le copilote ne sait pas ce qui te protège : il ne propose ni défense ni satellites. Une planète sans défense rend la moitié de son stock au premier pilleur, et lui ne perd rien.`,
    how:['Ouvre Défense sur chaque planète : le copilote lit chaque type au passage.', `Il ajoute ensuite les pièces manquantes au plan, avec leur prix et leur durée.`]});
  /* Le jeu nomme ce que son chantier construit, jamais combien, et sa file
     n'annonce que le lot en cours. Après un lot, le copilote ne sait donc plus
     ce qui est au sol : il se tait sur ce chantier au lieu de reproposer ce qui
     vient d'en sortir. Une page relue le rend bavard aussitôt. */
  const flous = S.planets.filter(chantierARelire);
  if(flous.length) out.push({id:'chantierlu', q:'Chantier', every:6, sev:'warn', tags:flous.map(planetRef),
    what:flous.length>1 ? `Ouvrir la page Chantier spatial (${flous.length} planètes)` : `Ouvrir la page Chantier spatial sur ${planetRef(flous[0])}`,
    why:`Ton chantier a sorti un lot que le copilote n'a pas relu : le jeu dit ce qu'il construit, jamais combien. Tant que la page n'est pas rouverte, il ne propose ni vaisseau, ni défense, ni satellite ${flous.length>1?'sur ces planètes':'sur cette planète'} — il doublerait ce que tu viens de construire.`,
    how:['Le bouton Actualiser, en haut : son relevé passe par le chantier et la défense de chaque planète.', 'Ou ouvre Chantier spatial sur la planète : le copilote recompte tout au passage.', 'La page Flotte fait aussi l\'affaire pour les vaisseaux ; la page Défense pour la défense.', 'Les cartes de chantier reviennent aussitôt, avec les bons nombres.']});
  const occ = API && API.planets ? occupied() : null;
  if(occ && parseC(S.colo.target) && occ.has(S.colo.target) && occ.get(S.colo.target)!==S.me && !colSentNow()){ const alt = colonyCandidates()[0]; out.unshift({id:'colo-taken', q:'Colonie', every:6, sev:'bad', coords:S.colo.target, what:`${S.colo.target} est déjà occupée`, why:alt?`Meilleure position libre proche : ${alt.coords} (${alt.bonus||'pas de bonus'}, ~${alt.fields} cases).`:'Choisis une autre position dans Outils › Cibles.', how:['Outils › Cibles › Où coloniser : clique sur Choisir pour changer la destination.']}); }
  // Chaque sonde occupe un emplacement de flotte jusqu'à son retour : en
  // proposer plus que d'emplacements libres, c'est envoyer le joueur sur un
  // « Nombre maximal de flottes atteint ». Emplacements inconnus : on en
  // suppose assez, comme avant.
  /* Une cible déjà espionnée ne revient pas le lendemain : sans ça le plan
     répète les trois meilleures coordonnées tant qu'on ne les pille pas. */
  const dejaVu = r => { const l = S.raids[r.coords]; return !!l && now-l.at < (l.probe?24:6)*3600e3; };
  const rtAll = raidTargets().filter(r=>!r.outlaw && !dejaVu(r));
  const libres = fs ? Math.max(0, fs[1]-fs[0]) : 3, rt = rtAll.slice(0, Math.min(3, libres));
  if(S.raid && S.raid.safe && !raidPlan().stale && (S.raid.m||S.raid.c||S.raid.d)) out.unshift({id:'raid-go', q:'Pillage', every:1, sev:'good', coords:S.raid.coords, what:`Pillage de ${S.raid.coords} prêt`, why:'Les ressources sont saisies et la cible est sans défense : lance-le depuis Outils › Cibles.', how:['Outils › Cibles : vérifie la flotte proposée, puis envoie-la en mission Attaquer.', 'Clique sur Lancé pour suivre le retour.']});
  /* Plus de cibles que d'emplacements : ce n'est pas la chasse qui manque,
     c'est la place. Le dire sans nommer ce qui la donne laisse le joueur
     devant un constat. */
  /* L'œil de la Galaxie n'ouvre pas de formulaire : il envoie les sondes
     déjà au sol. Sans sonde, le jeu répond « Vous n'avez pas sélectionné de
     vaisseaux » et le joueur cherche l'erreur chez lui. On ne le sait qu'une
     fois le chantier lu : sinon p.ships est vide sans rien prouver. */
  const vuesChantier = S.planets.filter(p=>p.shipsAt);
  const sansSonde = vuesChantier.length > 0 && !vuesChantier.some(p=>((p.ships||{}).pr||0) > 0);
  const bride = rtAll.length > rt.length;
  if(rt.length) out.push({id:'raid', q:'Pillage', every:12, sev:'good', coords:rt[0].coords, mark:rt.map(r=>r.coords), what:`Espionner ${rt.length>1?'ces inactifs':'cet inactif'} : ${rt.map(r=>r.coords).join(', ')}`, whatHtml:`Espionner ${rt.length>1?'ces inactifs':'cet inactif'} : ${rt.map(r=>coordLink(r.coords)).join(', ')}`, why:`Inactifs proches et moins forts que toi : pas d'avertissement hors-la-loi.${bride?` ${rtAll.length} repérés, mais ${libres} emplacement${libres>1?'s':''} de flotte libre${libres>1?'s':''}.`:''} Détail dans Outils › Cibles.`, how:[sansSonde ? 'Aucune sonde au sol : construis-en au chantier spatial avant d\'espionner. L\'œil de la Galaxie envoie les sondes déjà là, sinon le jeu répond « Vous n\'avez pas sélectionné de vaisseaux ».' : 'Galaxie : clique sur l\'œil de la ligne pour envoyer une sonde.', 'Un chiffre ou une étoile dans sa ligne : les minutes depuis la dernière activité sur la planète. Sur un inactif, c\'est le plus souvent la sonde d\'un autre pilleur — le stock sera maigre.', 'Chaque sonde occupe un emplacement de flotte jusqu\'à son retour.', 'Rapport sans flotte ni défense et avec des ressources : mission Attaquer, assez de soute pour la moitié de son stock.'].concat(bride ? [leverFlotte()] : [])});
  else if(!rtAll.length) out.push({id:'inactive', q:'Pillage', every:24, sev:'info', what:'Repérer des inactifs à piller', why:'Les joueurs marqués (i) ou (I) ne se défendent plus. À piller dès qu\'ils sont dans ta tranche de points.',
    how:['Galaxie : parcours ton système et les voisins, note les noms gris (i)/(I).', 'Espionne-les. Si le jeu affiche « joueur plus puissant », réponds <b>Non</b> : tu perdrais ta protection pendant 7 jours.', 'Sans flotte ni défense et avec des ressources : mission Attaquer avec assez de soute.']});
  const ns = +S.day.nightStart, nd = poseHeure(new Date(now), ns); if(nd.getTime() <= now) nd.setDate(nd.getDate()+1);
  const nightAt = nd.getTime() - 3600e3;
  /* Un rapatriement laisse les transporteurs stationnés là où ils ont chargé —
     c'est voulu, un Transporter repartirait seul et ne serait plus là pour la
     charge suivante. Mais rien ne les ramenait : au bout de quelques colonies,
     toute la soute dort sur les colonies et la planète la plus riche passe la
     nuit pleine, sans un vaisseau pour lever quoi que ce soit. L'inventaire le
     dit, cette carte le répare. */
  /* La flotte cible : une carte Rééquilibrer par paire source → cible quand
     une planète est loin de la sienne (Outils › Flotte). Elle couvre ce que
     la carte « Ramène » disait pour la même planète : on n'en garde qu'une. */
  const fcR = flotteCible(now), reeq = reequilibreCartes(now, fcR);
  out.push(...reeq);
  const reeqVers = new Set(reeq.map(m => m.dstId));
  /* « Ramène… » était critique dès midi pour un vol de 25 minutes : la carte
     passait devant les constructions avec dix heures d'avance. Elle ne
     devient critique qu'à l'heure où il ne reste plus que le vol et une heure
     de marge avant le rappel de fleet save. Le rappel retenu est celui qui
     précède la nuit qui vient — à 22 h 30, celui de 22 h, pas celui du
     lendemain — et jamais après le début de la nuit. Sans rappel réglé,
     l'heure d'avant-nuit (nightAt), comme avant. */
  const rappelRegle = S.settings.secu && /^\d{1,2}:\d{2}$/.test(String(S.settings.secu.rappel || ''));
  const rappelAt = rappelRegle ? Math.min(prochaineHeure(secu().rappel, nd.getTime() - 12*3600e3), nd.getTime()) : nightAt;
  for(const g of cargoGaps()){
    if(reeqVers.has(g.p.id)) continue;
    const don = g.ailleurs[0]; if(!don) continue;
    const {ships, cargo} = pickCargo(don.p, Math.min(g.manque, don.dispo));
    if(!Object.keys(ships).length) continue;
    const fl = flight(don.p.coords, g.p.coords, ships, 100); if(!fl) continue;
    const arrive = now + fl.secs*1000;
    const tard = arrive > nightAt + 3600e3;
    const escalade = rappelAt - fl.secs*1000 - 3600e3;
    const sev = tard ? 'warn' : (now >= escalade ? 'bad' : 'info');
    out.push({id:'cargo-split:'+g.p.id, q:'Sécurité', every:12, sev,
      ...(sev === 'info' ? {sol:`À faire avant ${formatTime(escalade)} (vol de ${dur(fl.secs)}, rappel à ${formatTime(rappelAt)})`} : {}),
      what:`Ramène ${shipList(ships)} de ${planetRef(don.p)} vers ${planetRef(g.p)}`,
      ships, dest:g.p.coords, mission:4, p:S.planets.indexOf(don.p),
      why:`${planetRef(g.p)} garde ${fmt(g.load)} de ressources et ${g.cargo ? `seulement ${fmt(g.cargo)} de soute au sol` : 'aucun transporteur'} : ce soir, il n'y a rien pour les mettre à l'abri. ${fmt(don.dispo)} de soute libre dorment sur ${planetRef(don.p)}.`,
      /* taskHtml pose `how` tel quel dans innerHTML — c'est ce qui fait rendre
         le <b> — alors que what et why passent par esc(). Tout ce qui vient de
         la page du jeu s'échappe donc ici à la main. */
      how:['Mission <b>Stationner</b>, pas Transporter : un Transporter repartirait seul et les vaisseaux ne seraient plus là au coucher.',
        `${dur(fl.secs)} de vol, ${fmt(fl.fuel)} deutérium${tard ? ` — arrivée vers ${formatTime(arrive)}, après le début de la nuit. Pour cette nuit-là, dépense le stock sur place.` : `, arrivée vers ${formatTime(arrive)}, avant la nuit.`}`,
        `Il te restera ${fmt(cargo)} de soute à demeure sur ${esc(planetRef(g.p))} : garde-la là, c'est elle qui part chaque soir.`]
        .concat(flotteAjout(fcR, don.p, g.p) ? [esc(flotteAjout(fcR, don.p, g.p))] : [])});
  }
  if(S.day.night || (!isNight(now) && nightAt - now <= (+S.day.horizon||24)*3600e3)){
    const fs = fleetsavePlan(now);
    /* « Avant la nuit (23 h) » à dix heures du matin ne veut rien dire : le
       mode nuit lancé en pleine journée est une absence, et la carte doit
       nommer le retour, pas le coucher. */
    const abs = absenceJour(now);
    /* Et « avant la nuit » à trois heures du matin ne veut rien dire non plus :
       la nuit a commencé, il reste à protéger ce qu'elle expose. */
    const quand = abs ? (S.day.backHour == null ? `Absence de ${nightLen()} h` : `Absence jusqu'à ${S.day.backHour} h`)
      : isNight(now) ? 'Cette nuit'
      : `Avant la nuit (${heureTxt(ns)})`;
    /* `at` dit à quelle connexion la carte appartient : l'heure du rappel
       d'avant-coucher en mode jour, et maintenant dès que le mode nuit est
       allumé. Le garder à nightAt en mode nuit renvoyait la carte au soir
       SUIVANT — rangée dans une connexion à venir, que le mode nuit n'affiche
       pas : réveillé à 3 h, le joueur n'avait plus une seule carte. */
    /* Une carte par planète, comme en mode jour. La carte du soir listait les
       autres lots dans son « Comment faire » — « Puis depuis D 90 3 : 20 grands
       transporteurs… » — un pavé à relire à chaque envoi, sans lien préparé et
       sans « Fait » à cocher. Chaque lot a donc sa carte, son formulaire déjà
       rempli et son propre état. Le plus gros garde l'identifiant `night`, et
       avec lui l'état des soirs passés et les avertissements d'empire. */
    /* Les trous de soute sont comptés une fois pour toute la rubrique : chaque
       carte y lit le sien, et les lignes d'empire le reste. */
    const trous = cargoGaps();
    const carteLot = (r, tete) => {
      /* Ce qui part vraiment : la soute plafonne le stock, et l'annoncer entier
         mettrait à l'abri, sur le papier, ce qui passe la nuit au sol. */
      const porte = Math.min(r.load, r.cargo);
      /* « 1,58 M au sol » ne dit pas s'il faut un hangar à métal ou un plein de
         deutérium, et c'est la première chose que le joueur vérifie dans le jeu
         avant de charger. Les trois chiffres, donc, à l'endroit où il regarde. */
      const st = stockNow(r.from);
      /* Ce que la soute ne lève pas reste au sol toute la nuit. Le dire ici, sur
         la carte de la planète concernée, avec l'endroit où la soute dort. */
      const manque = r.load - porte, trou = manque > 0 ? trous.find(x=>x.p === r.from) : null;
      const don = trou && trou.ailleurs[0];
      return {id: tete ? 'night' : 'night:' + r.from.id, q:'Sécurité', at:S.day.night ? now : nightAt,
        every:24, sev:'warn', tags:[planetRef(r.from)],
        what:`${quand} : envoie ${shipList(r.ships)} de ${planetRef(r.from)} en mission ${FS_MISSION_N[r.mission]} vers ${r.dest}`,
        ships:r.ships, dest:r.dest, p:S.planets.indexOf(r.from), mission:FS_MISSION[r.mission],
        /* Les trois nombres à taper dans le formulaire de chargement, en
           pastilles copiables : c'est la seule chose que le lien ne prépare
           pas, avec la vitesse. */
        res:partAbri(st, porte, r.fuel),
        why:`${fmt(porte)} ressources à l'abri sur ${r.from.name}${porte < r.load ? `, sur ${fmt(r.load)} au sol` : ''}. Une flotte en vol ne peut pas être détruite ; ce qui dort au sol se fait prendre.${r.deborde && r.deborde.length ? ' ' + debordeTexte((planeteEn(r.dest) || {}).name || r.dest, r.deborde) + ' Aucune autre planète assez loin n\'a la place.' : ''}`,
        /* Carte fermée, le joueur ne lit que le titre, la pastille et cette
           ligne : c'est le seul endroit où « j'ai un million de métal » se voit
           sans cliquer. Le ⓘ et le « Comment faire » demandent tous deux un
           geste, et un total ne dit pas s'il faut un hangar ou un plein. */
        sol:`au sol : ${fmt(st[0])} métal · ${fmt(st[1])} cristal · ${fmt(st[2])} deutérium`,
        /* « Dépense d'abord » ne vaut qu'une fois : répété sur chaque carte, il
           rallongeait quatre « Comment faire » pour un seul geste. */
        how:(tete ? ['Dépense d\'abord ce que tu peux : lance une construction longue et une recherche.'] : []).concat([
          `Charge ${porte < r.load ? `${fmt(porte)} sur ${fmt(r.load)}` : `<b>tout</b> le stock`} dans ${shipList(r.ships)} sur ${esc(r.from.name)}, destination ${esc(r.dest)}, mission ${FS_MISSION_N[r.mission]}. ${porte < r.load ? 'La soute ne lève pas le reste : il passe la nuit au sol. Les pastilles disent quoi charger — le deutérium d\'abord, il vaut trois métaux.' : 'Ne laisse rien de valeur au sol.'}`
        ].concat(manque > 0 ? [`${fmt(manque)} restent au sol faute de soute${don ? ` : ${fmt(don.dispo)} de soute libre dorment sur ${esc(planetRef(don.p))}, et la carte « Ramène… » plus haut l'amène ici. Fais-la avant de charger.` : `, et toute la soute libre de l'empire est déjà promise ailleurs : il faut en construire ici.`}`] : []).concat([
          `Règle la vitesse sur ${r.pct} % — c'est la seule chose que le lien ne prépare pas, et elle change d'un jour à l'autre exprès : une routine se chronomètre. ${r.mission === 'transport' ? `Les ressources se posent sur ${esc(r.dest)} vers ${formatTime(r.arrive)}${r.arrive > wakeTime(now) ? ', après ton réveil' : ' (coffre-fort)'}, et la flotte rentre vers ${formatTime(r.back)}.` : `La flotte rentre vers ${formatTime(r.back)}, après ton réveil.`} Coût : ${fmt(r.fuel)} deutérium.`,
          /* Le pourquoi de la méthode, et pas seulement le quoi : c'est lui qui
             évite au joueur de « simplifier » en Transporter le soir où il est
             pressé. Il reste sur chaque carte parce que la mission, elle, change
             d'un lot à l'autre. */
          r.mission === 'transport'
            ? `Mission <b>Transport</b> : la flotte décharge à l'arrivée puis revient seule, rien ne reste stationné ailleurs. Sois en ligne <b>avant l'arrivée</b> pour dépenser ce qui se pose. Une limite : un Transport se voit à la phalange, et une fois le retour commencé il ne se rappelle plus.`
            : `La position 16 n'accepte que l'Expédition : la flotte revient chargée, rien ne se pose ailleurs. C'est un pis-aller — le wiki ne la compte pas parmi les mises à l'abri, et un mauvais événement peut te coûter les vaisseaux et ce qu'ils portent. ${r.ships.pr ? 'La sonde à bord double ce qu\'elle rapporte.' : 'Une sonde à bord doublerait ce qu\'elle rapporte.'} Le Transport ne vaudra mieux que vers une planète assez loin pour se poser après ton réveil.`]))};
    };
    const m = fs ? carteLot(fs, true) : {id:'night', q:'Sécurité', at:S.day.night ? now : nightAt, every:24, sev:'warn',
      what:`${quand} : mettre tes ressources à l'abri`,
      why:'Une planète pleine pendant ton sommeil est une cible.',
      how:['Dépense tout ce que tu peux (files longues, satellites).', 'Envoie le reste avec tes transporteurs en mission longue (transport vers une colonie à vitesse 10 %, ou expédition).', 'Au réveil, rappelle ou récupère la flotte.']};
    /* La mise à l'abri protège la flotte et ce qu'elle emporte, pas les planètes
       qu'elle laisse derrière : elles produisent huit heures de plus. Les nommer,
       parce que c'est exactement ce que le pilleur d'inactifs vient chercher. */
    /* Une absence de jour n'expose pas une nuit : elle expose le temps que le
       joueur sera parti. */
    const nuit = abs ? Math.max(1, Math.round((wakeTime(now) - now)/3600e3)) : nightLen();
    /* Ce que la mise à l'abri emporte ne reste pas exposé. Le compter quand
       même annonçait au joueur qu'il laissait derrière lui le stock qu'on
       venait de lui dire de charger : sur une planète vidée, il ne reste que
       la production de la nuit. */
    const emporte = new Map();
    if(fs) for(const r of [fs].concat(fs.rest||[])) emporte.set(r.from, Math.min(r.load, r.cargo));
    const exposees = S.planets.map(p=>{
      const pr = production(p), st = stockNow(p);
      const part = (emporte.get(p)||0) / Math.max(1, st[0]+st[1]+st[2]);
      const reste = st.map(x=>x*Math.max(0, 1-part));
      const fin = [0,1,2].map(j=>Math.min(pr.cap[j], reste[j] + [pr.m,pr.c,pr.d][j]*nuit));
      return {p, eq: mse(fin[0], fin[1], fin[2])};
    }).filter(x=>x.eq > 50000).sort((a,b)=>b.eq-a.eq);
    /* Une planète sans donneur n'a pas de carte « Ramène… » : l'envoyer la
       chercher serait l'envoyer vers rien. Elle est nommée à part, avec le
       seul geste qui lui reste. */
    const ligne = x=>`${esc(planetRef(x.p))} (${fmt(x.load)}, il manque ${fmt(x.manque)} de soute)`;
    const aides = trous.filter(x=>x.ailleurs[0]), seules = trous.filter(x=>!x.ailleurs[0]);
    if(aides.length) m.how.push(`Sans soute pour les lever : ${aides.map(ligne).join(', ')}. Les cartes « Ramène… » disent d'où la faire venir.`);
    if(seules.length) m.how.push(`Sans soute pour les lever, et plus rien à emprunter : ${seules.map(ligne).join(', ')}. Toute la soute libre de l'empire est déjà promise ailleurs — il faut en construire sur place.`);
    if(exposees.length) m.how.push(`Resteront exposés au matin : ${exposees.map(x=>`${esc(planetRef(x.p))} (~${fmt(x.eq)} éq.)`).join(', ')}. ${exposees[0].p.def == null ? 'Ouvre la page Défense pour que le plan monte ce qu\'il faut.' : `Le plan monte ${esc(planetRef(exposees[0].p))} vers son modèle de défense : ${esc(defMixList(exposees[0].p))}.`}`);
    out.push(m);
    for(const r of (fs && fs.rest) || []) out.push(carteLot(r, false));
  }
  /* Le profil décide ici aussi de ce qui sort : une carte de défense n'a rien
     à dire à un raideur, un focus Expéditions remonte les siennes. */
  const tri = out.filter(m => poidsCat(catMission(m)) > 0)
    .sort((a, b) => poidsCat(catMission(b)) - poidsCat(catMission(a)));
  /* Mode nuit : le joueur va dormir. Seule la rubrique Sécurité parle de
     mettre les ressources à l'abri ; tout le reste attendra le réveil. */
  return S.day.night ? tri.filter(m=>m.q === 'Sécurité') : tri;
}
/* Le copilote ne voit pas ce que le joueur décide dans le jeu : une carte qu'il
   a choisi de ne pas suivre revient au plan suivant, et au suivant — cinq fois
   la même, et le panneau ne sert plus à rien. « Non » la met donc de côté, et
   elle y reste : rien ne la ramène dans le dos du joueur. C'est lui qui la
   remet, d'un bouton, sous les cartes d'Aujourd'hui comme dans Réglages. */
/* Tous les genres que le plan propose de lui-même. « Lancé » fait disparaître
   un chantier, mais seulement une fois lancé : tant que le joueur a un autre
   projet pour cette planète — monter l'usine de robots avec les ressources
   qu'il vient d'y faire venir — le hangar que le classement trouve rentable
   revient à chaque passage, et c'est lui qu'on lit au lieu du plan.
   Hors du compte : `raid` et `ship`, que le joueur a demandés lui-même dans
   Outils, et `expo`, dont le plan ne dessine plus la carte. */
export const NO_KINDS = {transfer:1, fleet:1, b:1, t:1, lf:1, sats:1, shipbuild:1, def:1};
/* La clé d'une carte déjà dessinée, celle que son bouton « Non » porte. Elle
   doit tomber sur la même que la garde posée plus haut, à la génération :
   sinon le bouton ne fait rien et la carte revient au passage suivant.
   Une recherche est à l'empire, pas à la planète du labo — sans ça, déménager
   le labo ramenait une carte écartée. */
export function actKey(a){
  const quoi = a.dest || a.k || a.id || Object.keys(a.ships||{})[0] || '';
  return cardKey(a.kind, a.kind === 't' ? '' : (S.planets[a.p]||{}).id, quoi);
}
/** Un morceau de clé : minuscules sans accents, `2:430:16` devient `2-430-16`. */
function cleBout(s){ return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
/* La règle d'une mission, quand son id ne la dit pas : la mise à l'abri de
   tête s'appelle `night` et ses voisines `night:<planète>`, mais c'est la même
   règle — et la tête change de planète quand les stocks bougent. */
const REGLE_MISSION = {night:'fleetsave-nuit'};
/**
 * L'identité d'une recommandation pour son affichage : `{type}:{règle}:{planète}:{cible}`.
 * Ni montant, ni heure, ni nombre de vaisseaux : ils changent sans que la
 * recommandation change, et la carte ne doit pas se replier pour autant.
 * La planète est son id, pas son nom (deux colonies peuvent s'appeler pareil).
 * @param {object} m une mission de dailyMissions()
 * @returns {string} ex. `securite:fleetsave-nuit:k3x9f1a:2-430-16`
 */
export function missionKey(m){
  const [base, suite] = String(m.id || '').split(/:(.*)/s);
  const p = S.planets[m.p], pid = p ? p.id : (suite && planetById(suite) ? suite : '');
  return [cleBout(String(m.q || 'a-faire').split('·')[0]), REGLE_MISSION[base] || cleBout(base), cleBout(pid), cleBout(m.dest || m.coords || '')].join(':');
}
/** Combien de cartes sont mises de côté en ce moment. */
function noCount(){ return Object.keys(S.daily.no).length; }
/** Le genre d'une carte, en clair. `expo` reste du passé : le plan n'en dessine
    plus, mais un vieux refus en stockage doit se nommer pour se retirer. */
const NO_NOM = {b:'Bâtiment', t:'Recherche', lf:'Forme de vie', sats:'Satellites',
  shipbuild:'Chantier spatial', def:'Défense', transfer:'Rapatriement', fleet:'Flotte',
  expo:'Expédition', m:'À faire'};
/**
 * Le nom lisible d'une carte mise de côté. Sans lui la liste afficherait
 * `b:k3x9f1a:smetal`, et remettre une carte reviendrait à tirer au sort.
 * Le libellé se reconstruit depuis la clé, jamais depuis un texte rangé à
 * côté : une sauvegarde d'avant cette liste se nomme donc aussi bien, et
 * rien ne se désynchronise.
 * @param {string} key la clé rangée dans `S.daily.no`
 * @param {object[]} [miss] les missions du jour, pour les clés `m:`
 * @returns {string}
 */
export function noLabel(key, miss){
  const k = String(key);
  // Une mission ne porte que son identifiant : c'est la carte du jour qui dit
  // son texte. Absente — période passée, condition retombée — l'identifiant
  // reste, et il vaut mieux que rien.
  if(k.slice(0,2) === 'm:'){ const m = (miss||[]).find(x=>'m:'+x.id === k); return `${NO_NOM.m} · ${m ? m.what : k.slice(2)}`; }
  /* Une destination porte ses propres deux-points (`1:142:6`) : on découpe sur
     les deux premiers, pas sur tous. */
  const parts = k.match(/^([^:]*):([^:]*):(.*)$/);
  if(!parts) return k;
  const [, kind, pid, quoi] = parts;
  const p = pid ? planetById(pid) : null;
  /* Chaque genre a sa table : `B` et `T` partagent des clés, et chercher dans
     les deux nommerait une recherche d'après un bâtiment. */
  let nom = quoi;
  if(kind === 'b') nom = (B[quoi]||{}).n || quoi;
  else if(kind === 't') nom = (T[quoi]||{}).n || quoi;
  else if(kind === 'def') nom = quoi === 'pack' ? 'Packs du modèle (surplus)' : (DEF[quoi]||{}).n || quoi;
  else if(kind === 'shipbuild') nom = (SHIPS[quoi]||{}).n || quoi;
  else if(kind === 'lf') nom = p ? lfNom(p, quoi) : quoi;
  else if(kind === 'sats') nom = '';
  // transfer, fleet, expo : la destination se lit telle quelle.
  return [NO_NOM[kind] || kind, p ? planetRef(p) : (pid || ''), nom].filter(Boolean).join(' · ');
}
export function missionDone(m){
  /* Une marque périmée est une marque morte : la carte est revenue, et c'est
     tout l'intérêt de sa période. Ne poser la marque que sur une case vide
     laissait donc la carte éteinte une fois, jamais deux — le rapatriement
     d'hier gardait la place, et la flotte envoyée aujourd'hui ne pouvait plus
     rien éteindre. On regarde donc si la marque vit encore, pas si elle existe.
     Noté, pas seulement constaté : le mouvement disparaît des mouvements de
     flotte dès l'arrivée, et la carte reviendrait alors que le geste est fait.
     Un « Fait » posé ici tient le même temps qu'un « Fait » cliqué. */
  /* La journée civile ne borne que les cartes quotidiennes : une carte plus
     rare, marquée faite hier, revenait quand même à minuit — sa période ne
     servait à rien. Au-delà de 24 h, seule la durée compte. */
  const vivante = d => !!d && (Date.now() - d) < m.every*3600e3 && (m.every!==24 || new Date(d).toDateString()===new Date().toDateString());
  if(!vivante(S.daily.done[m.id]) && flotteEnVol(m)){ S.daily.done[m.id] = Date.now(); save(); }
  return vivante(S.daily.done[m.id]); }
