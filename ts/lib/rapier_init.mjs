// Initializes the Rapier physics engine and exposes it as window.RAPIER.
// This is loaded as <script type="module"> so it can use ES module imports.
// Non-module scripts can access window.RAPIER once 'rapierReady' event fires.
import * as RAPIER from './rapier/rapier.mjs';
await RAPIER.init();
window.RAPIER = RAPIER;
window.dispatchEvent(new CustomEvent('rapierReady'));
console.log('Rapier physics engine initialized (v' + RAPIER.version() + ')');
