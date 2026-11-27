/* Lecture des modules ES du panneau, sans dépendance : juste assez d'analyse
   pour que le harnais les évalue comme le navigateur, et pour que les
   vérifications de structure (cycles, imports manquants) tiennent.

   Le harnais ne charge pas les modules avec import() : il faudrait une
   instance neuve par test (plus de mille), synchrone, avec un DOM et une
   horloge factices propres à chacun. Il les met donc bout à bout dans une
   seule portée, dans l'ordre où le navigateur les évalue, privés de leurs
   `import` et de leurs `export`. Ce que cette mise à plat ne voit pas — un
   nom emprunté sans import, un import d'un nom qui n'est pas exporté — les
   vérifications de test/run.js le cherchent, et la vérification de
   chargement réel (test/esm.js) le rattrape au chargement. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/* Les mots après lesquels un « / » ouvre une expression régulière et non une division. */
const AVANT_REGEX = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'throw', 'case', 'do', 'else', 'yield', 'await']);

/**
 * Découpe un source en jetons : identifiants, ponctuations, chaînes, nombres,
 * expressions régulières. Les commentaires disparaissent, le texte des
 * gabarits aussi (seules leurs expressions `${…}` restent, en jetons).
 * Chaque jeton porte `nl` (une fin de ligne le précède) et `prof` (profondeur
 * de parenthèses, crochets et accolades).
 */
function jetons(src) {
  const out = [];
  let i = 0, nl = false, prof = 0;
  // pile des gabarits ouverts : la profondeur où leur `${` a été ouvert
  const gabarits = [];
  const pousse = (t, v) => { out.push({ t, v, nl, prof }); nl = false; };
  const precedent = () => out[out.length - 1];
  const regexPermise = () => {
    const p = precedent();
    if (!p) return true;
    if (p.t === 'id') return AVANT_REGEX.has(p.v);
    if (p.t === 'p') return !/^[)\]}]$/.test(p.v);
    return false;
  };
  /** Lit le texte d'un gabarit depuis i jusqu'à « ` » ou « ${ ». */
  const texteGabarit = () => {
    while (i < src.length) {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { i++; pousse('tpl', ''); return; }
      if (c === '$' && src[i + 1] === '{') { i += 2; pousse('tpl', ''); gabarits.push(prof); prof++; return; }
      if (c === '\n') nl = true;
      i++;
    }
  };
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') { nl = true; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const f = src.indexOf('*/', i + 2); if (src.slice(i, f).includes('\n')) nl = true; i = f < 0 ? src.length : f + 2; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; j++; }
      pousse('str', src.slice(i + 1, j)); i = j + 1; continue;
    }
    if (c === '`') { i++; texteGabarit(); continue; }
    if (c === '}' && gabarits.length && gabarits[gabarits.length - 1] === prof - 1) {
      gabarits.pop(); prof--; i++; texteGabarit(); continue;
    }
    if (/[A-Za-z_$À-￿]/.test(c)) {
      let j = i + 1;
      while (j < src.length && /[\w$À-￿]/.test(src[j])) j++;
      pousse('id', src.slice(i, j)); i = j; continue;
    }
    if (/\d/.test(c) || (c === '.' && /\d/.test(src[i + 1]))) {
      let j = i + 1;
      while (j < src.length && /[\w.]/.test(src[j])) { if (/[eE]/.test(src[j]) && /[+-]/.test(src[j + 1])) j++; j++; }
      pousse('num', src.slice(i, j)); i = j; continue;
    }
    if (c === '/' && regexPermise()) {
      let j = i + 1, classe = false;
      while (j < src.length) {
        const d = src[j];
        if (d === '\\') { j += 2; continue; }
        if (d === '[') classe = true; else if (d === ']') classe = false;
        else if (d === '/' && !classe) break;
        else if (d === '\n') break;
        j++;
      }
      j++;
      while (j < src.length && /[a-z]/.test(src[j])) j++;
      pousse('re', src.slice(i, j)); i = j; continue;
    }
    // ponctuations : les plus longues d'abord
    const p3 = src.slice(i, i + 4).match(/^(?:>>>=|\.\.\.|===|!==|\*\*=|<<=|>>=|>>>|&&=|\|\|=|\?\?=|=>|==|!=|<=|>=|&&|\|\||\?\?|\?\.|\+\+|--|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|\*\*|<<|>>)/);
    const v = p3 ? p3[0] : c;
    if ('([{'.includes(v)) { pousse('p', v); prof++; i += v.length; continue; }
    if (')]}'.includes(v)) { prof--; pousse('p', v); i += v.length; continue; }
    pousse('p', v); i += v.length;
  }
  return out;
}

/**
 * Les `import` d'un module : [{ de, noms }], `de` résolu depuis la racine du
 * dépôt, `noms` les identifiants importés (vide pour un import de bord).
 */
function imports(fichier) {
  const src = fs.readFileSync(path.join(ROOT, fichier), 'utf8');
  const dir = path.dirname(fichier);
  const out = [];
  for (const m of src.matchAll(/^import\s+(?:\{([^}]*)\}\s+from\s+)?['"]([^'"]+)['"]\s*;?/gm)) {
    const noms = (m[1] || '').split(',').map(x => x.trim()).filter(Boolean);
    out.push({ de: path.posix.normalize(path.posix.join(dir, m[2])), noms });
  }
  return out;
}

/** Les noms qu'un module exporte, par `export function|const|let|class` ou `export { … }`. */
function exports_(fichier) {
  const src = fs.readFileSync(path.join(ROOT, fichier), 'utf8');
  const noms = new Set();
  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) noms.add(m[1]);
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm))
    m[1].split(',').map(x => x.trim()).filter(Boolean).forEach(n => noms.add(n));
  return noms;
}

/**
 * Les modules dans l'ordre où le navigateur les évalue depuis `entree` :
 * chaque module après ceux qu'il importe, un cycle laissant le module déjà
 * en cours là où il est (comme le fait l'évaluation des modules ES).
 */
function ordre(entree) {
  const vus = new Set(), out = [];
  const visite = f => {
    if (vus.has(f)) return;
    vus.add(f);
    for (const { de } of imports(f)) visite(de);
    out.push(f);
  };
  visite(entree);
  return out;
}

/** Le source d'un module sans ses `import` ni ses mots `export`, pour la mise à plat du harnais. */
function aplatir(fichier) {
  return fs.readFileSync(path.join(ROOT, fichier), 'utf8')
    .replace(/^import\s+(?:\{[^}]*\}\s+from\s+)?['"][^'"]+['"]\s*;?/gm, '')
    .replace(/^export\s*\{[^}]*\}\s*;?/gm, '')
    .replace(/^export\s+(?=(?:async\s+)?(?:function|class|const|let|var)\b)/gm, '');
}

/** Les noms déclarés au niveau supérieur d'un source (fonctions, classes, const/let/var). */
function nomsHaut(src) {
  const j = jetons(src), noms = new Set();
  for (let k = 0; k < j.length; k++) {
    const x = j[k];
    if (x.prof !== 0 || x.t !== 'id') continue;
    if (x.v === 'function' || x.v === 'class') {
      let n = j[k + 1];
      if (n && n.v === '*') n = j[k + 2];
      if (n && n.t === 'id') noms.add(n.v);
      continue;
    }
    if (x.v === 'const' || x.v === 'let' || x.v === 'var') {
      // chaque déclarateur : l'identifiant qui suit le mot, puis chaque virgule à la profondeur 0
      if (j[k + 1] && j[k + 1].t === 'id') noms.add(j[k + 1].v);
      for (let m = k + 2; m < j.length; m++) {
        const y = j[m];
        if (y.prof === 0 && (y.v === ';' || (y.nl && y.t === 'id' && !(j[m - 1].t === 'p' && j[m - 1].v === ',')))) break;
        if (y.prof === 0 && y.v === ',' && j[m + 1] && j[m + 1].t === 'id' && j[m + 2] && j[m + 2].v === '=') noms.add(j[m + 1].v);
      }
    }
  }
  return noms;
}

/**
 * Les identifiants qu'un source emploie comme variables, et ceux qu'il
 * déclare quelque part (à n'importe quelle profondeur, paramètres compris).
 * Un nom déclaré localement peut masquer celui d'un autre module : on ne
 * l'exige alors pas à l'import (un excès de prudence ne casse rien, l'oubli
 * se voit au chargement réel).
 */
function usages(src) {
  const j = jetons(src), emplois = new Set(), locaux = new Set();
  for (let k = 0; k < j.length; k++) {
    const x = j[k];
    if (x.t !== 'id') continue;
    const av = j[k - 1], ap = j[k + 1];
    if (av && av.t === 'p' && (av.v === '.' || av.v === '?.')) continue;
    // clé d'objet : `{ nom: …` ou `, nom: …`
    if (ap && ap.v === ':' && av && (av.v === '{' || av.v === ',')) continue;
    if (av && (av.v === 'const' || av.v === 'let' || av.v === 'var' || av.v === 'function' || av.v === 'class')) { locaux.add(x.v); continue; }
    // paramètre d'une flèche à un seul nom : `x => …`
    if (ap && ap.v === '=>') { locaux.add(x.v); continue; }
    emplois.add(x.v);
  }
  // paramètres et motifs : tout identifiant dans les parenthèses d'une fonction ou d'une flèche, dans un catch, ou dans un motif de déclaration
  for (let k = 0; k < j.length; k++) {
    const x = j[k];
    let ouvre = -1;
    if (x.v === 'function') { ouvre = k + 1; while (j[ouvre] && j[ouvre].v !== '(') ouvre++; }
    else if (x.v === 'catch' && j[k + 1] && j[k + 1].v === '(') ouvre = k + 1;
    else if ((x.v === 'const' || x.v === 'let' || x.v === 'var') && j[k + 1] && (j[k + 1].v === '{' || j[k + 1].v === '[')) ouvre = k + 1;
    else if (x.v === '=>' && j[k - 1] && j[k - 1].v === ')') {
      // remonter à la parenthèse ouvrante
      let p = k - 1, d = 0;
      for (; p >= 0; p--) { if (j[p].v === ')') d++; else if (j[p].v === '(') { d--; if (!d) break; } }
      ouvre = p;
    }
    else if (x.v === 'for' && j[k + 1] && j[k + 1].v === '(') {
      const y = j[k + 2];
      if (y && (y.v === 'const' || y.v === 'let' || y.v === 'var')) {
        if (j[k + 3] && j[k + 3].t === 'id') locaux.add(j[k + 3].v); else ouvre = k + 3;
      }
    }
    if (ouvre < 0 || !j[ouvre]) continue;
    const base = j[ouvre].prof;
    for (let m = ouvre + 1; m < j.length && j[m].prof > base; m++) {
      const y = j[m];
      if (y.t !== 'id') continue;
      const av = j[m - 1], ap = j[m + 1];
      // une valeur par défaut emploie des noms sans les déclarer : on ne prend que ce qui suit ( , { [ … ou :
      if (av && /^(?:\(|,|\{|\[|\.\.\.|:)$/.test(av.v) && (!ap || /^(?:\)|,|\}|\]|=|:)$/.test(ap.v))) {
        if (ap && ap.v === ':' && av.v !== ':') continue; // `{ cle: nom }` : c'est `nom` le local
        locaux.add(y.v);
      }
    }
  }
  return { emplois, locaux };
}

module.exports = { ROOT, jetons, imports, exports_, ordre, aplatir, nomsHaut, usages };
