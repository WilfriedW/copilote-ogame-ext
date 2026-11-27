/* Point d'entrée du panneau latéral (issue #49, étape 0).

   boot.js l'ajoute en `<script type="module">` une fois le stockage lu, à la
   place de l'ancien app.js classique. Il n'importe pour l'instant que app.js,
   qui tire lui-même src/meteo.js et src/flotte/cible.js ; chaque domaine
   sorti d'app.js viendra s'importer ici ou depuis le module qui s'en sert.

   ids.js et profils.js restent des scripts classiques, chargés avant par
   sidepanel.html : ids.js sert aussi aux content scripts et au service
   worker, qui ne chargent pas de modules ES. Leurs déclarations restent
   visibles des modules, comme toute déclaration de script classique. */
import '../app.js';
