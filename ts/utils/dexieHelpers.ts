import Dexie from "https://cdn.skypack.dev/dexie";

const apiRoot = "http://localhost:3002/api/v1";
// const apiRoot = "https://api.nanobase.org/api/v1";

interface EntryType {
  id: string;
  structure: { data: ArrayBuffer; commitName: string }[];
  structureName: string;
  date: number;
}

const DexieDB = new Dexie("Structures") as Dexie & {
  structureData: Dexie.Table<EntryType, string>;
};

DexieDB.version(1).stores({
  structureData: "id, structureName",
});

(window as any).DexieDB = DexieDB;
(window as any).apiRoot= apiRoot;
