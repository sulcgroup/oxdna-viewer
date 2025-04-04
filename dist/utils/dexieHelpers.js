import Dexie from "https://cdn.skypack.dev/dexie";
const apiRoot = "http://localhost:3002/api/v1";
const DexieDB = new Dexie("Structures");
DexieDB.version(1).stores({
    structureData: "id, structureName",
});
window.DexieDB = DexieDB;
window.apiRoot = apiRoot;
