/* ---------- les formats ----------
   Les nombres et les coûts tels que le panneau les écrit (`nf`, `fmt`,
   `fmtLigne`, `fmtCourt`, `num`, `coutTexte`, `costHtml`), l'échappement du
   HTML (`esc`), et la façon de nommer une planète (`planetRef`, `planetTag`,
   `planetHue`, `qHtml`).

   Module du noyau (issue #49) : il n'importe que le noyau, et tous les
   domaines comme les vues peuvent s'en servir. */
import { S } from './etat.js';

/* ---------- formatting ---------- */
export const nf = new Intl.NumberFormat('fr-FR');
/** Les chiffres d'une ligne repliée, jamais abrégés. `fmt` bascule en « k » à
    cent mille : une colonne de sept planètes qui produisent dans le même ordre
    de grandeur y mélangeait « 112 k » et « 82 951 », deux écritures du même
    nombre, que l'œil ne compare plus. Et au-dessus d'un champ de stock qui dit
    `1200000`, un « 1,20 M » n'aide pas à le recaler. La place ne manque pas
    sur cette ligne : on les écrit en entier. */
export const fmtLigne = n => isFinite(n) ? nf.format(Math.round(n)) : '∞';
/** Un coût en clair, sans nommer les ressources qu'il ne demande pas. */
export const coutTexte = c => { const l = ['métal','cristal','deutérium'].map((n,i)=>c[i]>0?`${fmt(c[i])} de ${n}`:'').filter(Boolean);
  return l.length < 2 ? (l[0] || 'rien') : `${l.slice(0,-1).join(', ')} et ${l[l.length-1]}`; };
export function fmt(n){ if(!isFinite(n)) return '∞'; const a=Math.abs(n); if(a>=1e9) return (n/1e9).toFixed(2).replace('.',',')+' G'; if(a>=1e6) return (n/1e6).toFixed(2).replace('.',',')+' M'; if(a>=1e5) return (n/1e3).toFixed(0)+' k'; return nf.format(Math.round(n)); }
/* L'apostrophe compte autant que le guillemet : data-launch est un attribut
   à apostrophes, et « Tour d'habitation » — un nom qui est dans notre propre
   table — y refermait l'attribut au milieu du JSON. Le bouton « Lancé » mourait
   sur la carte, et la fin du nom se retrouvait lue comme des attributs. */
export function esc(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
/* Le pendant de `esc` pour les champs tenus pour des nombres. Les textes de ce
   panneau passent par `esc` ; les nombres n'en avaient pas besoin — sauf qu'une
   sauvegarde peut y avoir mis une chaîne, et `value="${x}"` n'échappe rien.
   `d` est ce qui s'affiche à défaut. */
export function num(v, d=0){ const x = Number(v); return Number.isFinite(x) ? x : d; }
export function costHtml(c){ return `<span class="cost"><span class="c-m">${fmt(c[0])}</span><span class="c-c">${fmt(c[1])}</span><span class="c-d">${fmt(c[2])}</span></span>`; }
/**
 * Comment désigner une planète sans ambiguïté.
 * OGame nomme « Colonie » toutes les colonies par défaut : tant que le nom est
 * unique on l'affiche seul, sinon on ajoute les coordonnées.
 * @param {object} p planète
 * @returns {string}
 */
export function planetRef(p){
  if(!p) return '';
  const homonyme = S.planets.filter(x=>x.name===p.name).length > 1;
  return homonyme && p.coords ? `${p.name} [${p.coords}]` : p.name;
}
/** La planète au meilleur laboratoire : c'est de là qu'on lance une recherche. */
/* Autant de couleurs que de planètes raisonnablement suivies ; au-delà, on
   boucle plutôt que de risquer deux teintes indistinguables. */
export const PLANET_COLORS = 6;
/** Pastille colorée d'une planète, couleur stable sur son rang dans la liste. */
export function planetTag(name){
  const i = S.planets.findIndex(p => p.name === name || planetRef(p) === name);
  return `<span class="ptag" style="--pc:var(--p${(i < 0 ? 0 : i) % PLANET_COLORS})">${esc(name)}</span>`;
}
/** Le rang de couleur d'une planète : le même que celui de sa pastille, pour
    que la page du jeu et le panneau parlent de la même planète en une seule
    teinte. Une planète inconnue n'en a pas. */
export function planetHue(name){
  const i = S.planets.findIndex(p => p.name === name || planetRef(p) === name);
  return i < 0 ? null : i % PLANET_COLORS;
}
/** Étiquette « Catégorie · Planète » : la planète devient une pastille. */
export function qHtml(q){
  const i = String(q || '').indexOf(' · ');
  return i < 0 ? esc(q || '') : esc(q.slice(0, i)) + ' ' + planetTag(q.slice(i + 3));
}
/** « 12 k », « 1,20 M » : un débit se lit d'un coup d'œil. */
export function fmtK(n){ return !isFinite(n) ? '∞' : Math.abs(n) >= 1e6 ? fmt(n) : Math.abs(n) >= 1e4 ? `${Math.round(n / 1e3)} k` : fmt(n); }
/* ---------- réglages du plan ---------- */
export const majus = s => s.charAt(0).toUpperCase() + s.slice(1);
/* Une décimale au plus, et rien quand elle est nulle : « 2,5 », « 25 ». */
export const nf1 = new Intl.NumberFormat('fr-FR', {maximumFractionDigits:1});
const nf3 = new Intl.NumberFormat('fr-FR', {maximumFractionDigits:3});
/** Le format court d'un pack : « 307,5 k », « 1,305 M ». `fmt` arrondit trop
    pour comparer deux modèles — 307,5 k y devient 308 k. */
export function fmtCourt(n){ const a = Math.abs(n); return a >= 1e6 ? `${nf3.format(n / 1e6)} M` : a >= 1e3 ? `${nf3.format(n / 1e3)} k` : nf.format(n); }
/** Un texte comparable sans casse ni accents : « Métal » et « metal » se
    reconnaissent dans un minuteur collé comme dans un rapport. */
export const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
