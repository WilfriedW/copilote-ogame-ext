/* ---------- les briques de balisage ----------
   Deux gabarits que plusieurs onglets partagent : la bascule Oui/Non
   (`bascule`) et la jauge d'une ligne chiffrée (`gauge`).

   Vue de l'issue #49. Elle n'importe rien : ce sont des chaînes. */

/* Oui/Non : une bascule, pas une liste déroulante. Deux états se lisent d'un
   coup d'œil et tiennent sur une ligne, là où le select coûtait un titre, une
   ligne de plus et un clic pour voir ce qu'on savait déjà. */
export const bascule = (id, attr, label, coche, note='') =>
  `<label class="f bascule"><span>${label}</span><input type="checkbox" id="${id}" ${attr} ${coche?'checked':''}>${note?`<span class="note">${note}</span>`:''}</label>`;
export const gauge = (k,cls,label,v,sub) => `<div class="gauge"><span class="k"><i class="bg-${cls}"></i>${label}</span><span class="v c-${cls}">${v}</span>${sub?`<span class="s">${sub}</span>`:''}</div>`;
