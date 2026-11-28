/* ---------- l'onglet Réglages ----------
   Le compte, le plan du jour, la sécurité, les formes de vie, les règles du
   moteur, les cases masquées et la version (`VIEWS_REGLAGES`,
   `REFRESH_REGLAGES`).

   Module des vues (issue #49), calé sur l'issue #9. app.js réassemble `VIEWS` et
   `REFRESH` à partir des morceaux de chaque onglet. Ce module emprunte encore
   à app.js le rendu et les calculs qui n'ont pas de module : ce cycle-là est
   toléré tant qu'app.js existe, et rien n'y est lu au chargement. */
import { S } from '../core/etat.js';
import { esc, num } from '../core/format.js';
import {
  DEF, DEF_RATIO, defRatio, defAncre, DEF_DUREES, DEF_PLANCHERS,
  defPalierOpts
} from '../defense/defense.js';
import { RACE_SRC, nomRace, LIFEFORMS, readLifeforms, lfIds } from '../formes-de-vie/formes-de-vie.js';
import { RESEARCH_MODE, researchMode, simulateDay } from '../plan/journee.js';
import { hhmmDe, heureTxt, nightLen } from '../plan/nuit.js';
import { FOCUS } from '../plan/priorites.js';
import { planPoseParLeStyle, classeEcart, profilLigne, profilFocusHtml } from '../plan/profil.js';
import { REGLES_ERR, REGLES_PAR_ID, NIVEAU_SEV, DOMAINES, regle } from '../regles/moteur.js';
import { secu } from '../securite/securite.js';
import { fold, cardLayout, affichageCard } from './navigation.js';
import {
  APP_VERSION, VERSIONS, MAJ, raceDe, SEV_LABEL, LF_MODE, lfMode, HABILLAGES,
  habillage, MASQUE_CLES, masque, toutMasque, noListe, defModeleCarte,
  defPicker, bascule, aide, actsVus, plusRecente
} from '../../app.js';
/** Réglages › Formes de vie : la race de chaque planète, d'où elle vient, et de quoi la corriger. */
function raceRows(){
  const ps = (S.planets || []).filter(p => lfIds(p).length || p.race);
  if(!ps.length) return '';
  return `<p class="note mt-2 mb-1"><b>Race par planète</b> — corrige-la si la lecture se trompe : la valeur posée à la main l'emporte.</p><ul class="list">${ps.map(p => {
    const r = raceDe(p), etat = r.conflit ? 'contradictoire' : r.race ? `${nomRace(r.race)} · ${RACE_SRC[r.src] || ''}` : 'inconnue';
    return `<li><span><b>${esc(p.name)}</b> <span class="note">${esc(etat)}</span></span><select data-race="${esc(p.id)}" class="w-auto"><option value="">Lire dans le jeu</option>${Object.entries(LIFEFORMS).map(([k, l]) => `<option value="${k}" ${p.race === k ? 'selected' : ''}>${esc(l.n)}</option>`).join('')}</select></li>`;
  }).join('')}</ul><div class="row mt-2"><button class="btn sm ghost" data-rescan="1" title="Oublie les noms lus et relance les conseils : utile après une mise à jour du jeu">Rescanner</button><span class="note">Les noms se relisent à la prochaine visite des pages Formes de vie.</span></div>`;
}

/**
 * Réglages › Règles : une ligne par règle, groupées par domaine, dans l'ordre
 * du fichier. Une règle à verrou garde sa case grisée et dit pourquoi : une case
 * qui ne fait rien sans le dire est un mensonge par omission.
 */
function reglesCard(){
  const ids = Object.keys(REGLES_PAR_ID);
  if(REGLES_ERR || !ids.length) return `<div class="card"><h2>Règles du moteur</h2><p class="note">${esc(REGLES_ERR || 'Aucune règle dans rules.json.')}</p></div>`;
  const ligne = id => {
    const r = regle(id);
    const champs = Object.keys(r.parametres || {}).map(k => `<label class="note row gap-1">${esc(k)}<input type="number" step="any" data-rg-p="${esc(id)}:${esc(k)}" value="${esc(r.parametres[k])}" class="court"></label>`).join('');
    return `<li><label class="ligne-interrupteur"><input type="checkbox" data-rg-on="${esc(id)}" ${r.on ? 'checked' : ''} ${r.verrou ? 'disabled' : ''} class="interrupteur">`
      + `<span><span class="pill ${NIVEAU_SEV[r.niveau] || 'info'}">${esc(SEV_LABEL[NIVEAU_SEV[r.niveau]] || r.niveau)}</span> <b>${esc(r.nom || id)}</b> <span class="note mono">${esc(id)}</span>`
      + `${r.statut === 'a_valider' ? ' <span class="pill info">à valider</span>' : ''}`
      + `${r.verrou ? `<br><span class="note">Toujours active : ${esc(r.pourquoi_verrou || 'la simulation en a besoin.')}</span>` : ''}</span></label>`
      + `${champs ? `<span class="row gap-2">${champs}</span>` : ''}</li>`;
  };
  const groupes = Object.entries(DOMAINES).map(([d, n]) => {
    const l = ids.filter(id => REGLES_PAR_ID[id].domaine === d);
    return l.length ? `<h3 class="note mt-2 mb-1">${esc(n)}</h3><ul class="list">${l.map(ligne).join('')}</ul>` : '';
  }).join('');
  return `<details class="card"${fold('regles', false)}><summary data-fold="regles">Règles du moteur <span class="note">${ids.filter(id => regle(id).on).length} sur ${ids.length} actives</span></summary>
    <p class="note mt-2">Ce que le copilote surveille sur chaque planète, et ce que le plan en fait.</p>
    ${aide('regles', '<p class="note">Décocher une règle l\'éteint : sa carte ne sort plus, et elle ne compte plus sur l\'icône. Les seuils se changent ici ; le reste vit dans <code>rules.json</code>.</p>')}
    ${groupes}</details>`;
}
/* Les trois menus du haut se ressemblent et ne disent pas la même chose : le
   premier dit ce que le plan vise, les deux autres seulement quand la recherche
   et les formes de vie passent dans la journée. Rien à l'écran ne le disait, et
   on cherchait la recherche dans la priorité. Chaque menu porte donc, sous lui,
   ce que le choix en place fait vraiment — c'est la phrase, pas l'étiquette,
   qui répond à « c'est quoi ce réglage ». */
const AIDE_JOUR = {
  focus: {t:'Ce que le plan vise', v:{
    equi: 'Les paliers qui servent l\'économie et la flotte à la fois, et d\'abord les plafonds que tu touches tous les jours : expéditions, emplacements de flotte.',
    ecocol: 'Des mines, et une planète de plus dès qu\'Astrophysique l\'autorise : une colonie rapporte alors plus qu\'un niveau de recherche.',
    eco: 'Des mines, rien d\'autre : le plan ne colonise pas, et la recherche vise la production — Énergie, Laser, Ion, Plasma.',
    fleet: 'Combustion, Impulsion, Ordinateur, Hyperespace : de quoi faire voler plus d\'expéditions et de pillages. Le plan colonise encore.',
    raid: 'Espionnage, Combustion, Impulsion 5 et Ordinateur : voir les inactifs, y aller vite, en mener plusieurs à la fois. Pas de technologie de combat — l\'onglet Cibles ne pille que ce qui ne tire pas. Le plan colonise encore.',
  }},
  research: {t:'Place de la recherche', v:{
    normal: 'La recherche attend son tour : le plan n\'épargne pour elle que si la feuille de route la juge critique.',
    first: 'La prochaine recherche passe devant les chantiers : les bâtiments de la planète du labo attendent.',
  }},
  lf: {t:'Place des formes de vie', v:{
    after: 'Les formes de vie passent après les bâtiments, et s\'effacent devant un chantier proche.',
    first: 'Les formes de vie passent avant les bâtiments. La recherche garde sa place : réglée « Avant les bâtiments », elle est servie avant elles.',
    off: 'Le plan ne propose aucune forme de vie.',
  }},
};
const MASQUE_NOMS = {pub: 'Masquer la pub', bandeau: 'Masquer la bannière', chat: 'Masquer le chat'};
const MASQUE_NOTES = {
  pub: 'Bannières publicitaires et encarts promotionnels.',
  bandeau: 'La barre Gameforge en haut de page : compte, lobby, liens externes.',
  chat: 'La barre de chat et ses fenêtres repliées. Un nouveau message fait sortir une pastille dans le coin ; un clic dessus rouvre le chat jusqu\'à la page suivante.'
};
/** Les trois cases, telles que les Réglages les montrent. */
function masqueCases(prefixe){
  return MASQUE_CLES.map(k=>bascule(prefixe + k, `data-masque="${k}"`, MASQUE_NOMS[k], masque[k], MASQUE_NOTES[k])).join('');
}

/* ---------- la sécurité : réglages ---------- */
/** Réglages › Sécurité : coffres-forts, rappel de mise à l'abri, mission. */
function secuCard(){
  const c = secu(), J = ['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'];
  return `<div class="card"><h2>Sécurité et mise à l'abri</h2>
    <p class="note">Coffres-forts : les planètes où mettre ta flotte à l'abri. Le plan choisit le plus proche, même galaxie d'abord, jamais un coffre-fort attaqué.</p>
    <div class="chips">${S.planets.map(p=>`<label class="chip"><input type="checkbox" data-secu-vault="${esc(p.id)}" ${c.vaults.includes(p.id)?'checked':''}> ${esc(p.name)} <span class="note">${esc(p.coords||'')}</span></label>`).join('')}</div>
    <div class="grid mt-2">
      <label class="f">Heure du rappel<input type="time" data-secu="rappel" value="${esc(c.rappel)}"></label>
      <label class="f">Réveil = fin de nuit (heure)<input type="time" data-day="nightEnd" value="${hhmmDe(S.day.nightEnd)}"><span class="note">La même que « Nuit : à » du plan du jour.</span></label>
    </div>
    <div class="chips mt-2">${[1,2,3,4,5,6,0].map(j=>`<label class="chip"><input type="checkbox" data-secu-jour="${j}" ${c.jours.includes(j)?'checked':''}> ${J[j]}</label>`).join('')}</div>
    ${aide('secu', '<p class="note">À l\'heure du rappel, les jours cochés, l\'icône du Copilote affiche « FS » jusqu\'à ce que tu ouvres le plan de la nuit. Aucune notification. Heures en heure locale du navigateur.</p>')}
  </div>`;
}
/* ---------- daily missions ---------- */
/**
 * Pastilles des réglages : une espèce lue sur une planète s'affiche sans case,
 * les autres restent à cocher.
 * @returns {string}
 */
function lfSettingsHtml(){
  const lues = readLifeforms();
  return Object.entries(LIFEFORMS).map(([k,l]) => lues.includes(k)
    ? `<span class="pill good choix"><input type="checkbox" checked disabled class="w-auto mr-2">${l.n} · lue sur tes planètes</span>`
    : `<label class="pill ${S.lf.found.includes(k)?'good':'info'} choix"><input type="checkbox" data-lf="${k}" ${S.lf.found.includes(k)?'checked':''} class="w-auto mr-2">${l.n}</label>`).join('');
}
export const VIEWS_REGLAGES = {
settings(){
  const s=S.settings, d=S.day;
  const ecart = classeEcart();
  /* ENH-54 : treize cartes empilées faisaient une page de 5 800 px. Elles se
     rangent en cinq onglets (CARTES.settings) ; toutes restent dans le DOM,
     masquées, pour que REFRESH.settings et bind() les trouvent. */
  return cardLayout('settings', {
    jeu: `
    <div class="card"><h2>Profil et plan du jour</h2>
      <p class="note">${S.profil.set ? `Ton profil : <b>${esc(profilLigne())}</b>.` : 'Pas encore renseigné : l\'assistant t\'attend en tête d\'Aujourd\'hui.'}</p>
      ${S.profil.set ? `<div class="chips mt-2">${profilFocusHtml()}</div>
      ${aide('focus', '<p class="note">Les focus ponctuels remontent leurs cartes sans remplacer ton style. Les poids de chaque catégorie sont dans <code>profils.js</code>.</p>')}` : ''}
      ${ecart ? `<p class="note">${esc(ecart)}</p>` : ''}
      <div class="row mb-3"><button class="btn sm ghost" data-refaire="1">Refaire le questionnaire</button></div>
      <div class="grid">
        <label class="f">Ce que le plan vise<select id="dFocus" data-day="focus">${Object.entries(FOCUS).map(([k,l])=>`<option value="${k}" ${d.focus===k?'selected':''}>${l}</option>`).join('')}</select>${planPoseParLeStyle() ? `<span class="note">Posé par ton style (${esc(PROFILS.styles[S.profil.style].n)}).</span>` : ''}</label>
        <label class="f">Place de la recherche<select id="dRes" data-day="research">${Object.entries(RESEARCH_MODE).map(([k,l])=>`<option value="${k}" ${researchMode()===k?'selected':''}>${l}</option>`).join('')}</select></label>
        <label class="f">Place des formes de vie<select id="dLf" data-day="lf">${Object.entries(LF_MODE).map(([k,l])=>`<option value="${k}" ${lfMode()===k?'selected':''}>${l}</option>`).join('')}</select></label>
        <label class="f">Je me connecte toutes les<select id="dInt" data-day="interval">${[30,60,90,120,180].map(v=>`<option value="${v}" ${+d.interval===v?'selected':''}>${v} min</option>`).join('')}</select></label>
        <label class="f">Horizon<select id="dHz" data-day="horizon">${[12,24,48].map(v=>`<option value="${v}" ${+d.horizon===v?'selected':''}>${v} h</option>`).join('')}</select></label>
        <label class="f">Nuit : de (heure) — coucher<input id="dNs" type="time" data-day="nightStart" value="${hhmmDe(d.nightStart)}"></label>
        <label class="f">à (heure) — réveil<input id="dNe" type="time" data-day="nightEnd" value="${hhmmDe(d.nightEnd)}"></label>
      </div>
      <div class="bascules">
        ${bascule('dNight', 'data-day="night"', 'Mise à l\'abri (nuit, absence)', d.night)}
      </div>
      <div class="grid">
        <label class="f">Retour vers (heure)<input id="dBack" type="time" step="3600" data-day="backHour" value="${d.backHour==null?'':hhmmDe(d.backHour)}"><span class="note">Vide : retour dans ${nightLen()} h, la durée de la nuit.</span></label>
      </div>
      <p class="note" id="daySum"></p>
      ${aide('jour', '<p class="note" id="aideJour"></p>')}
    </div>
    <div class="card"><h2>Formes de vie découvertes</h2>
      <div class="chips">${lfSettingsHtml()}</div>
      <p class="note">Copilote s'en sert pour te conseiller la forme de vie de tes colonies.</p>
      ${raceRows()}
    </div>
    <div class="card"><h2>Bonus</h2>
      <div class="bascules">
        ${bascule('sGeo','data-set="geo"','Géologue (+10 % production)', s.geo)}
        ${bascule('sEng','data-set="eng"','Ingénieur (+10 % énergie)', s.eng)}
        ${bascule('sOver','data-set="crawlerOverload"','Foreuses en surcharge 150 %', s.crawlerOverload, 'Moitié plus de bonus, énergie doublée. À régler comme dans le jeu.')}
        ${bascule('sColCargo','data-set="colCargo"','Collecteur : +25 % soute transporteurs', s.colCargo)}
      </div>
      <div class="grid">
        <label class="f">Ratio d'échange M:C:D<input id="sRatio" data-set="ratio" value="${s.ratio.join(':')}"></label>
      </div>
    </div>
    <div class="card"><h2>Énergie</h2>
      <div class="bascules">
        ${bascule('sSats','data-set="sats"','Autoriser les satellites solaires dans les recommandations', s.sats, 'Moins chers que la centrale sur une planète chaude, mais un satellite part en débris au premier raid, grossit le butin de l\'attaquant, et l\'énergie retombe avec lui. Ceux que tu as déjà posés comptent dans ta production, réglage ou non.')}
      </div>
      ${aide('energie', '<p class="note">Sans cette case, le copilote ne propose que la centrale solaire et la centrale de fusion. Planète par planète, le réglage se surcharge dans l\'onglet Planètes.</p>')}
    </div>`,
    defense: `
    <div class="card"><h2>Modèle de défense</h2>
      <div class="grid">
        <div class="f"><span>Modèle</span>${defPicker(s.defModele)}</div>
        <label class="f">Palier visé<select id="sDefP" data-def="palier">${defPalierOpts(s.defPalier)}</select><span class="note">En ${esc(DEF[defAncre(defRatio(s.defModele) || {})].p)}. « Compléter » part de ce que la planète a déjà.</span></label>
        ${(()=>{ const st = S.profil.set ? PROFILS.styles[S.profil.style] : null; if(!st || st.plancher == null) return '';
          const v = s.defPlancher == null ? '' : String(s.defPlancher);
          return `<label class="f">Plancher<select id="sDefF" data-def="plancher"><option value="" ${v===''?'selected':''}>Comme le profil (${st.plancher})</option>${DEF_PLANCHERS.map(x=>`<option value="${x}" ${v===String(x)?'selected':''}>${x === 0 ? 'Aucun' : x}</option>`).join('')}</select><span class="note">En packs du modèle. Profil ${esc(st.n)} : tant que le palier n'est pas atteint, ses cartes passent d'abord.</span></label>`; })()}
        <label class="f">Durée max d'une carte<select id="sDefD" data-def="duree">${DEF_DUREES.map(x=>`<option value="${x}" ${num(s.defDuree,4)===x?'selected':''}>${x} h de chantier</option>`).join('')}</select><span class="note">Au-delà, le reste sort sur la carte suivante.</span></label>
      </div>
      ${defModeleCarte(s.defModele)}
      ${s.defModele === 'perso' ? `<div class="grid tight">${DEF_RATIO.map(k=>`<label class="f">${esc(DEF[k].n)}<input id="sDefR-${k}" type="number" min="0" step="1" data-def="${k}" value="${num(S.settings.defPerso[k])}"></label>`).join('')}</div>
      <p class="note">Combien de pièces par lanceur de plasma. Les deux boucliers restent hors modèle.</p>` : ''}
      ${S.profil.set && s.defModele === (PROFILS.styles[S.profil.style] || {}).defense
        ? `<p class="note">Posé par ton profil (<b>${esc(PROFILS.styles[S.profil.style].n)}</b>). En choisir un autre ici le détache du profil : refaire le questionnaire ne le remettra plus.</p>` : ''}
      ${aide('defense', '<p class="note">Les cartes Défense du plan ne proposent que les pièces de ce modèle, dans ses proportions. Outils › Défense dit, planète par planète, ce qui manque et ce que ça coûte ; une planète peut y prendre un autre modèle que celui-ci.</p>')}
    </div>
    ${secuCard()}`,
    affichage: `
    <div class="card"><h2>Allure du panneau</h2>
      <div class="grid">
        <label class="f">Thème<select id="sSkin" data-set="skin">${Object.entries(HABILLAGES).map(([k,l])=>`<option value="${k}" ${habillage()===k?'selected':''}>${l}</option>`).join('')}</select></label>
      </div>
      <div class="bascules">
        ${bascule('sMuet','data-set="muet"','Couper le son', s.muet, 'Plus de carillon à la fin d\'un minuteur, et les notifications du navigateur arrivent sans bruit.')}
      </div>
      <div class="row"><button class="btn ghost" id="uiReset">Réinitialiser l'affichage des cartes</button></div>
      ${aide('allure', '<p class="note">Relief suit le clair ou le sombre de ton système ; les trois autres sont sombres. Le changement se voit tout de suite, sur toutes les pages.</p><p class="note mt-2">Les cartes et les sections que tu as ouvertes ou fermées le restent, sur ce poste, d\'une page et d\'une session à l\'autre. « Réinitialiser l\'affichage des cartes » les remet comme au premier jour : alertes ouvertes, le reste fermé.</p>')}
    </div>
    ${affichageCard()}
    <div class="card"><h2>Page du jeu</h2>
      <div class="bascules">
        ${masqueCases('sMq')}
        ${bascule('sLean','data-set="lean"','Épurer la page du jeu', s.lean, 'En-tête et pied de page en moins ; fond sombre, menu plus grand.')}
        ${bascule('sNoShop','data-set="noshop"','Masquer les menus payants', s.noshop, 'Marchand, Mess des officiers, boutiques.')}
      </div>
      <div class="row"><button class="btn" type="button" data-masque-tout>${toutMasque() ? 'Tout afficher' : 'Tout masquer'}</button></div>
      <p class="note">Allure seulement : la page du jeu, pas ce panneau, ni les calculs.</p>
      ${aide('page', '<p class="note">Masqué, pas supprimé : les éléments restent dans la page et le jeu marche comme avant. La barre de ressources, les planètes, le menu et les alertes du jeu ne se masquent jamais. Chaque choix s\'applique tout de suite, dans tous les onglets ouverts, et se retrouve au prochain lancement.</p>')}
    </div>`,
    moteur: `
    ${reglesCard()}
    <div class="card"><h2>Fiabilité des calculs</h2>
      <p class="note">Formules communautaires (wiki OGame, forum officiel) : compare une fois avec ton jeu et ajuste les réglages si besoin.</p>
      ${aide('fiabilite', '<p class="note">Production, coûts et temps de vol sont stables depuis des années. Moins sûrs : la production de deutérium (formule des univers récents, dépend de la température max), la durée des bâtiments de niveau 1 à 5, et les plafonds d\'expédition.</p>')}
    </div>`,
    donnees: `
    <div class="card"><h2>Sauvegarde</h2>
      <p class="note">Tes données restent dans ce navigateur.</p>
      <div class="row"><button class="btn" id="ioSave">Enregistrer dans un fichier</button><button class="btn" id="ioLoad">Charger un fichier…</button><input type="file" id="ioFile" accept="application/json,.json" hidden><button class="btn ghost" id="ioReset">Réinitialiser…</button><span class="note" id="ioMsg"></span></div>
      <textarea id="ioText" aria-label="Données JSON" placeholder="Ou colle ici une sauvegarde pour l'importer"></textarea>
      <div class="row"><button class="btn" id="ioImport">Importer le texte collé</button></div>
      ${aide('sauvegarde', '<p class="note">« Enregistrer » écrit un fichier <code>save.json</code> : mets-le dans le dossier du dépôt et pousse-le, puis « Charger » le relit sur l\'autre poste.</p>')}
      ${noListe()}
    </div>
    ${versionCard()}`,
  });
},
};
export const REFRESH_REGLAGES = {
/* Le seul retour de l'écran Réglages. Sans lui, changer la priorité, l'horizon
   ou l'intervalle n'affichait rien du tout : la valeur partait bien au
   stockage et le plan s'en servait, mais il fallait passer sur Aujourd'hui
   pour savoir si le choix avait pris. Un réglage muet est un réglage dont on
   doute — et le badge du haut, lui, ne parle que de l'univers. */
settings(){
  const el = document.getElementById('daySum'); if(!el) return;
  const d = S.day;
  /* Avant le retour du mode nuit : les menus restent à l'écran la nuit, et une
     phrase qui disparaît quand le plan dort n'explique plus rien. */
  const choix = {focus: [d.focus, FOCUS], research: [researchMode(), RESEARCH_MODE], lf: [lfMode(), LF_MODE]};
  const aide = document.getElementById('aideJour');
  if(aide) aide.innerHTML = Object.keys(AIDE_JOUR).map(k=>{
    const [v, table] = choix[k];
    return `<b>${esc(AIDE_JOUR[k].t)}</b> · ${esc(table[v] || '')} — ${esc(AIDE_JOUR[k].v[v] || '')}`;
  }).join('<br>');
  if(d.night){ el.textContent = 'Mode nuit : le plan est en pause, seule la mise à l\'abri compte.'; return; }
  const plan = simulateDay();
  /* Les connexions qui portent quelque chose, dites comme telles : le résumé
     d'Aujourd'hui compte aussi les missions, et deux lignes qui annoncent le
     même mot avec deux chiffres différents est le pire des deux mondes. */
  const n = plan.sessions.slice(1).filter(x=>actsVus(x).length).length;
  const gain = plan.startV>0 ? (plan.endV/plan.startV-1)*100 : 0;
  // Deux heures égales ne font pas une nuit de zéro heure : elles n'en font aucune.
  const nuit = +d.nightStart === +d.nightEnd ? 'aucune nuit' : `nuit ${heureTxt(d.nightStart)}–${heureTxt(d.nightEnd)}`;
  el.textContent = `${FOCUS[d.focus]||''} · toutes les ${d.interval} min · ${nuit} · `
    + `${n} connexion${n>1?'s':''} avec quelque chose à lancer · `
    + `production ${gain>=0?'+':''}${gain.toFixed(1).replace('.',',')} % en ${d.horizon} h`;
},
};

/**
 * La carte Réglages › Version : où en est ce panneau, et quoi taper pour le
 * déplacer. Les deux lectures sont passées en argument pour que le test puisse
 * poser un dépôt en avance sans attendre le réseau.
 */
function versionCard(maj = MAJ, vers = VERSIONS){
  const retard = maj && plusRecente(APP_VERSION, maj);
  const etat = retard ? `Le dépôt est en <b>v${esc(maj)}</b>.`
    : maj ? 'C\'est la dernière du dépôt.'
    : 'La version du dépôt n\'a pas pu être lue.';
  return `<div class="card"><h2>Version</h2>
    <p class="note">Ce panneau tourne en <b>v${esc(APP_VERSION)}</b>. ${etat}</p>
    ${retard ? `<p class="pill warn">v${esc(maj)} disponible</p>
    <p class="note">Depuis le dépôt : <code>git pull &amp;&amp; ./pack.sh</code>. Depuis le zip : retélécharge-le et remplace le dossier. Puis « Recharger » sur <code>chrome://extensions</code>.</p>` : ''}
    ${vers.length ? `<details class="volet"${fold('vers', false)}><summary class="note" data-fold="vers">Historique des versions (${vers.length})</summary>
      <ul class="list mt-2">${vers.map(([v,d,h,s])=>`<li><div><b>v${esc(v)}</b> <span class="note">${esc(d)}</span><br><span class="note">${esc(s)}</span></div><code>${esc(h)}</code></li>`).join('')}</ul>
      <p class="note mt-2">Revenir à l'une d'elles : <code>git checkout <i>empreinte</i> &amp;&amp; ./pack.sh</code>, puis « Recharger ». Une version plus ancienne relit un stockage écrit par la nouvelle : garde un <code>save.json</code> d'avant sous la main.</p>` : `<p class="note">L'historique arrive au prochain <code>./pack.sh</code>.</p>`}
  </div>`;
}
