import Dexie from "https://cdn.skypack.dev/dexie";

const apiRoot = "http://localhost:3002/api/v1";
// const apiRoot = "https://api.nanobase.org/api/v1";

interface ShareInfo {
  shareUrl: string;
  shareId: string;
  createdAt: Date;
  expiresAt: Date;
}

interface CommitType {
  data: ArrayBuffer;
  commitName: string;
  commitId: string;
  parent: string;
  shareInfo?: ShareInfo;
}

interface EntryType {
  id: string;
  structure: CommitType[];
  structureName: string;
  date: number;
  branches: { [key: string]: string[] };
}

const DexieDB = new Dexie("Structures") as Dexie & {
  structureData: Dexie.Table<EntryType, string>;
  remoteStructureData: Dexie.Table<EntryType, string>;
};

DexieDB.version(1).stores({
  structureData: "id, structureName",
  remoteStructureData: "id, structureName",
});

(window as any).DexieDB = DexieDB;
(window as any).apiRoot = apiRoot;
