/* ---------- version, historique, mise à jour ----------
   Deux choses que le dépôt sait et que le panneau ignorait : d'où il vient, et
   s'il est en retard. L'historique est écrit par ./pack.sh dans `versions.tsv`,
   une ligne par commit : c'est son empreinte qu'on passe à `git checkout` pour
   revenir en arrière. La version du dépôt se lit sur son manifeste public.
   Ni l'un ni l'autre n'installe quoi que ce soit : une extension ne peut pas
   écrire dans son propre dossier, et le manifeste v3 lui interdit d'exécuter du
   code distant. Le panneau dit donc quoi taper, et s'arrête là.

   Domaine de l'issue #49. `APP_VERSION` reste dans app.js, où ./pack.sh et
   les vérifications la cherchent ; `litVersions` est appelée par app.js à la
   place où les deux lectures se faisaient. */
import { IS_EXT } from '../core/serveur.js';
import { tab } from './navigation.js';
import { APP_VERSION, toast, render } from '../../app.js';

/** L'historique tel que ./pack.sh l'écrit : [version, date, empreinte, sujet]. */
export let VERSIONS = [];
/** La version du dépôt, quand on a pu la lire. */
export let MAJ = null;

export const DEPOT_MANIFEST = 'https://raw.githubusercontent.com/WilfriedW/copilote-ogame-ext/main/manifest.json';
/** On ne redemande pas la version du dépôt plus souvent que ça. */
export const MAJ_TTL = 6 * 3600e3;

/**
 * Vrai si `b` est une version plus récente que `a`. Nombre par nombre :
 * l'ordre des chaînes mettrait « 2.10.0 » avant « 2.9.0 ».
 * @param {string} a @param {string} b
 */
export function plusRecente(a, b){
  const n = v => String(v).split('.').map(x => parseInt(x, 10) || 0);
  const x = n(a), y = n(b);
  for(let i = 0; i < Math.max(x.length, y.length); i++){
    const xi = x[i] || 0, yi = y[i] || 0;
    if(yi !== xi) return yi > xi;
  }
  return false;
}

/** Ce que la version du dépôt change à l'écran, qu'elle sorte du réseau ou du
    stockage. Le numéro vit dans l'en-tête, que le panneau étroit cache : sans
    le toast, une version neuve ne se verrait qu'en ouvrant les réglages. */
export function annonceMaj(){
  if(plusRecente(APP_VERSION, MAJ)) toast(`v${MAJ} disponible`);
  if(tab === 'settings') render();
}

/* Les deux lectures se font une fois, à l'ouverture du panneau. Hors de
   l'extension — la page de démonstration, le harnais de test — `getURL`
   n'existe pas et il n'y a rien à lire. */
export function litVersions(){
  if(!IS_EXT || !chrome.runtime.getURL) return;
  fetch(chrome.runtime.getURL('versions.tsv')).then(r => r.ok ? r.text() : '').then(t => {
    VERSIONS = t.split('\n').map(l => l.split('\t')).filter(c => c.length >= 4);
    if(VERSIONS.length && tab === 'settings') render();
  }).catch(()=>{});
  /* Le fichier est public et demandé sans identifiant ni cookie, mais une
     requête à chaque ouverture du panneau dirait quand même à GitHub à quelle
     heure ce joueur joue, jour après jour. La réponse est donc gardée six
     heures, et le reste du temps le panneau affiche ce qu'il sait déjà. */
  chrome.storage.local.get(['majAt', 'majVer'], d => {
    if(d.majVer){ MAJ = d.majVer; annonceMaj(); }
    if(d.majAt && Date.now() - d.majAt < MAJ_TTL) return;
    fetch(DEPOT_MANIFEST, {credentials:'omit'}).then(r => r.ok ? r.json() : null).then(m => {
      if(!m || !m.version) return;
      MAJ = m.version;
      try{ chrome.storage.local.set({majAt: Date.now(), majVer: MAJ}); }catch(e){}
      annonceMaj();
    }).catch(()=>{});
  });
}
