/* ---------- les conseils ----------
   Le bloc des conseils d'Aujourd'hui : les constats du moteur que le plan ne
   sert pas déjà par une carte (`conseilLignes`), leur rendu (`conseilHtml`,
   `conseilsHtml`) et la planète ouverte dans le jeu, qui passe en tête.

   Module des vues (issue #49), calé sur l'issue #16. Il emprunte encore à app.js
   ce qui n'a pas de module : ce cycle-là est toléré tant qu'app.js existe, et
   rien n'y est lu au chargement. */
import { S } from '../core/etat.js';
import { esc, costHtml } from '../core/format.js';
import { planetById } from '../core/planetes.js';
import { stockNow } from '../economie/production.js';
import { meteoFiltre, meteoVoit } from '../meteo.js';
import { poidsCat } from '../plan/profil.js';
import { SURPLUS_REGLES } from '../plan/surplus.js';
import { NIVEAUX, NIVEAU_SEV, SEV_NIVEAU, DOMAINES, rangNiveau, constatsVus } from '../regles/moteur.js';
import { fold } from './navigation.js';
import { ignKey, SEV_LABEL } from '../../app.js';

/* ---------- les règles du moteur : le bloc des conseils ---------- */
/**
 * Les lignes du bloc : les constats que le plan ne sert pas et que le joueur
 * n'a pas ignorés, puis les alertes qui ne sont pas des règles (bridage,
 * emplacements). Un constat servi n'y est pas : la carte du plan est sa
 * réponse, et le bloc n'est pas une seconde liste des mêmes choses.
 */
export function conseilLignes(plan){
  /* Les débordements ont leur carte, Ressources en trop, qui dit la perte et
     les solutions : les répéter ici ferait deux listes des mêmes choses. */
  const cs = constatsVus(plan.constats || []).filter(c => !c.servi && !SURPLUS_REGLES.includes(c.regle));
  const autres = (plan.alerts || []).filter(a => !a.regle).map(a => ({
    niveau:SEV_NIVEAU[a.sev] || 'conseil', sev:a.sev, what:a.what, why:a.why, pid:a.pid, domaine:'', cat:'', rang:Infinity}));
  const pi = new Map((S.planets || []).map((p, i) => [p.id, i]));
  return cs.map(c => Object.assign({sev:NIVEAU_SEV[c.niveau]}, c)).concat(autres)
    .sort((a, b) => rangNiveau(a.niveau) - rangNiveau(b.niveau) || poidsCat(b.cat) - poidsCat(a.cat)
      || a.rang - b.rang || (pi.get(a.pid) || 0) - (pi.get(b.pid) || 0));
}
/** La planète ouverte dans le jeu : `S.cur` est le gid que chaque instantané reprend. */
function planeteOuverte(){
  const ps = S.planets || [];
  return ps.find(p => S.cur != null && p.gid != null && String(p.gid) === String(S.cur)) || ps[0] || null;
}
function conseilHtml(l, avecPlanete){
  const p = planetById(l.pid);
  const st = p ? stockNow(p) : null;
  const cout = l.cost ? ` ${costHtml(l.cost)} <span class="note">${st && l.cost.every((x, j) => x <= st[j]) ? 'payable maintenant' : 'pas encore payable'}</span>` : '';
  const quand = l.vars && l.vars.attente ? ` <span class="note">ressources réunies vers ${esc(l.vars.attente)}</span>` : '';
  const tete = [l.domaine ? DOMAINES[l.domaine] || l.domaine : '', avecPlanete && p && S.planets.length > 1 ? p.name : ''].filter(Boolean).join(' · ');
  return `<li><span class="pill ${l.sev}">${SEV_LABEL[l.sev] || ''}</span><span class="what">${tete ? `<span class="note">${esc(tete)}</span> ` : ''}${esc(l.what)}${l.statut === 'a_valider' ? ' <span class="pill info">à valider</span>' : ''}</span>`
    + `<span class="why">${esc(l.why)}${l.action ? `<br>→ <b>${esc(l.action)}</b>${cout}${quand}` : quand}`
    /* « Scanner » ouvre la page à relire, d'un clic du joueur, comme toutes les
       cartes : le copilote ne navigue jamais seul. */
    + `${l.vars && l.vars.url ? ` <button class="btn sm" data-prep="${esc(l.vars.url)}">Scanner</button>` : ''}`
    + `${l.source ? ` <a href="${esc(l.source)}" target="_blank" rel="noopener">source</a>` : ''}`
    + `${l.regle ? ` <button class="btn sm ghost" data-ign="${esc(ignKey(l))}" title="Masqué jusqu'à ce que la situation change, ou 24 h">Ignorer</button>` : ''}</span></li>`;
}
/**
 * Le bloc des conseils d'Aujourd'hui : trois lignes de la planète ouverte dans
 * le jeu, puis l'empire entier, filtrable. Rien quand il n'y a rien à dire.
 */
export function conseilsHtml(plan){
  /* Le filtre de la météo vaut ici comme ailleurs : une planète choisie dans la
     grille, et le bloc ne parle plus que d'elle. */
  const mf = typeof meteoFiltre === 'function' ? meteoFiltre() : null;
  const l = conseilLignes(plan).filter(x => typeof meteoVoit !== 'function' || meteoVoit(x));
  if(!l.length) return '';
  const cur = mf || planeteOuverte(), f = (S.ui && S.ui.cf) || {};
  const tete = cur ? l.filter(x => x.pid === cur.id).slice(0, 3) : [];
  /* Un critique qui n'est pas dans les trois lignes de tête ouvre « Voir tout »
     de force, sans toucher au choix enregistré : passé, le volet revient comme
     le joueur l'avait laissé. */
  const critique = l.some(x => x.sev === 'bad' && !tete.includes(x));
  const tri = l.filter(x => (!f.domaine || x.domaine === f.domaine) && (!f.niveau || x.niveau === f.niveau)
    && (!f.planete || x.pid === f.planete) && (!f.manque || x.regle === 'FDV_DATA_MISSING'));
  const sel = (k, vide, opts) => `<select data-cf="${k}" class="w-auto"><option value="">${esc(vide)}</option>${opts.map(([v, n]) => `<option value="${esc(v)}" ${f[k] === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
  const filtres = `<div class="row gap-2 m-0 mt-2 mb-2">`
    + sel('domaine', 'Tous les domaines', Object.entries(DOMAINES))
    + sel('niveau', 'Tous les niveaux', NIVEAUX.map(n => [n, SEV_LABEL[NIVEAU_SEV[n]]]))
    + (S.planets.length > 1 && !mf ? sel('planete', 'Toutes les planètes', S.planets.map(p => [p.id, p.name])) : '')
    + `<label class="note row gap-1"><input type="checkbox" data-cf="manque" ${f.manque ? 'checked' : ''} class="interrupteur">Données manquantes</label></div>`;
  return `<div class="card"><h2>Conseils${cur && S.planets.length > 1 ? ` <span class="note">${esc(cur.name)}</span>` : ''}</h2>`
    + (tete.length ? `<ul class="advice">${tete.map(x => conseilHtml(x, false)).join('')}</ul>`
      : `<p class="note">Rien à signaler${cur ? ` sur ${esc(cur.name)}` : ''}.</p>`)
    + `<details class="volet"${fold('conseils', false, critique)}><summary class="note" data-fold="conseils">Voir tout (${l.length})</summary>${filtres}`
    + (tri.length ? `<ul class="advice">${tri.map(x => conseilHtml(x, true)).join('')}</ul>` : '<p class="note">Aucun conseil pour ces filtres.</p>')
    + `</details></div>`;
}
