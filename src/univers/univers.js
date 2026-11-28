/* ---------- l'univers ----------
   Ce que l'API publique d'OGame dit de l'univers : les systèmes en anneau
   (`wrapSys`, `sysDiff`), les positions occupées (`occupied`, avec son cache
   `_occ`), les points du joueur (`myScore`) et l'activité des autres
   (`isInactive`, `isActive`).

   Domaine de l'issue #49. Il ne lit que le noyau : la colonisation et le
   pillage l'importent. */
import { S } from '../core/etat.js';
import { API } from '../core/serveur.js';

/* ---------- targets from the official OGame API ---------- */
export function sysDiff(a, b){ let d = Math.abs(a-b); const sv = API && API.server; if(sv && sv.donutSystem) d = Math.min(d, sv.systems - d); return d; }
export function wrapSys(x){ const n = (API && API.server && API.server.systems) || 499; return ((x-1)%n+n)%n+1; }
let _occ = null, _occKey = null;
export function occupied(){ const k = API && API.at && API.at.universe; if(_occKey!==k){ _occ = new Map((API.planets||[]).map(([c,pl])=>[c,pl])); _occKey = k; } return _occ; }
export function myScore(){ return S.me && API && API.scores && API.scores[S.me] ? API.scores[S.me][0] : null; }
export function isInactive(st){ return /[iI]/.test(st||'') && !/[vb]/.test(st||''); }
export function isActive(st){ return !/[iIvb]/.test(st||''); }
