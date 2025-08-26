import Dexie from "https://cdn.skypack.dev/dexie";
const apiRoot = "https://api.nanobase.org/api/v1";
const DexieDB = new Dexie("Structures");
DexieDB.version(1).stores({
    structureData: "id, structureName",
    remoteStructureData: "id, structureName",
    temporaryStructure: "id",
});
window.DexieDB = DexieDB;
window.apiRoot = apiRoot;
