/* ---------- le sous-onglet Défense ----------
   La carte du modèle de défense et de ce qui manque à chaque planète
   (`VIEWS_DEFENSE`). Les calculs vivent dans src/defense/defense.js : ce
   module ne fait que les dessiner.

   Module des vues (issue #49), calé sur l'issue #17. app.js réassemble `VIEWS` à
   partir des morceaux de chaque onglet. Ce module emprunte encore à app.js le
   rendu : ce cycle-là est toléré tant qu'app.js existe, et rien n'y est lu au
   chargement. */
import { S } from '../core/etat.js';
import { fmt, esc, costHtml } from '../core/format.js';
import {
  DEF, DEF_MODELES, defModele, defRatio, defAncre, defPalierDe,
  defBloqueTexte, defPlan, defPalierOpts
} from '../defense/defense.js';
import { defRecetteHtml, defModeleCarte, defPicker } from '../../app.js';
/** Une planète dans l'onglet Défense : son modèle, ses pièces, son manque.
    Les deux menus portent `data-dp` : c'est lui qui distingue la surcharge
    d'une planète du réglage global, qui n'en a pas. */
function defCarte(p){
  const tete = `<div class="row spread"><h2>${esc(p.name)} <span class="note">${esc(p.coords)}</span></h2></div>`;
  const menus = `<div class="grid">
      <div class="f"><span>Modèle</span>${defPicker(p.defModele && DEF_MODELES[p.defModele] ? p.defModele : '', p.id)}</div>
      <label class="f">Palier<select data-def="palier" data-dp="${p.id}"><option value="">Comme les réglages</option>${defPalierOpts(p.defPalier)}</select></label>
    </div>`;
  const d = defPlan(p);
  if(!d) return `<div class="card">${tete}${menus}<p class="note">Défense jamais relevée ici : ouvre la page Défense de cette planète dans le jeu, ou clique Actualiser. Tant qu'elle est inconnue, annoncer un manque reviendrait à faire reconstruire ce qui est déjà au sol.</p></div>`;
  const exces = d.lignes.filter(l=>l.exces > 0), hors = d.lignes.filter(l=>l.hors), bloques = d.lignes.filter(l=>l.req);
  const enFile = d.lignes.some(l=>l.file > 0);
  return `<div class="card">${tete}${menus}
    <p class="note">${esc(d.nom)} · ${d.palier} ${esc(DEF[d.ancre].p)}${defPalierDe(p)==='fill' ? (d.lignes.some(l=>l.k===d.ancre && l.n + l.file > 0) ? ' déjà au sol' : ' : rien à compléter, le plus petit palier sert de départ') : ''}</p>
    ${p.defModele ? `<p class="note mono">${defRecetteHtml(defModele(d.modele))}</p>` : ''}
    ${d.plancherGap ? `<p class="pill warn">Sous le plancher de ton profil (${fmt(d.plancher)} ${esc(DEF[d.ancre].p)}) : ses cartes passent avant celles du palier.</p>` : ''}
    <div class="tbl-wrap"><table><thead><tr><th>Pièce</th><th class="n">Au sol</th>${enFile ? '<th class="n">En file</th>' : ''}<th class="n">Cible</th><th class="n">Manque</th><th>Coût du manque</th></tr></thead><tbody>
      ${d.lignes.map(l=>`<tr><td>${esc(DEF[l.k].n)}</td><td class="n">${fmt(l.n)}</td>${enFile ? `<td class="n">${l.file ? fmt(l.file) : '—'}</td>` : ''}<td class="n">${l.hors ? '<span class="note">hors modèle</span>' : fmt(l.cible)}</td><td class="n">${l.manque ? fmt(l.manque) : l.exces ? `<span class="note">+${fmt(l.exces)}</span>` : '—'}</td><td>${l.manque ? costHtml(l.cout) : ''}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="row gap-2 mt-2">${d.cout.some(x=>x > 0)
      ? `<span class="pill ${d.payable ? 'good' : 'warn'}">${d.payable ? 'Payable avec son stock' : 'Plus que son stock'}</span>${costHtml(d.cout)}`
      : `<span class="pill good">Le modèle est tenu</span>`}</div>
    ${exces.length ? `<p class="note">Au-dessus du modèle, et ça compte quand même : ${exces.map(l=>`${fmt(l.exces)} ${esc(DEF[l.k].p)}`).join(', ')}.</p>` : ''}
    ${hors.length ? `<p class="note">Hors modèle, au sol et compté, mais jamais redemandé : ${hors.map(l=>`${fmt(l.n + l.file)} ${esc(l.n + l.file > 1 ? DEF[l.k].p : DEF[l.k].o)}`).join(', ')}.</p>` : ''}
    ${bloques.length ? `<p class="pill warn mt-2">Pas encore débloqué, aucune carte en attendant : ${bloques.map(l=>esc(defBloqueTexte(l))).join(' · ')}</p>` : ''}
  </div>`;
}
export const VIEWS_DEFENSE = {
/* Le modèle se choisit dans les Réglages, une fois pour tout l'empire ; ici
   chaque planète dit ce qu'il lui manque pour le tenir, et peut en prendre un
   autre. Les deux endroits lisent le même réglage, personne ne le recopie. */
defense(){
  const s = S.settings, anc = defAncre(defRatio(s.defModele) || {});
  return `<section class="panel">
    <div class="card"><h2>Modèle de défense</h2>
      <p class="note"><b>${esc(DEF_MODELES[s.defModele].n)}</b> · ${s.defPalier === 'fill' ? 'compléter l\'existant' : `${s.defPalier} ${esc(DEF[anc].p)}`} <button class="btn sm ghost" data-goto="settings:defense">Modifier</button></p>
      ${defModeleCarte(s.defModele)}
      <p class="note">Le modèle donne la proportion entre les pièces, le palier la taille. Rien ne se construit ici, et le plan du jour garde son propre budget : la moitié d'une nuit de production, de quoi rendre le pillage non rentable.</p>
    </div>
    ${S.planets.map(defCarte).join('')}
  </section>`;
},
};
