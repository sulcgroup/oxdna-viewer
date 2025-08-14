import Dexie from "https://cdn.skypack.dev/dexie";

const apiRoot = "https://api.nanobase.org/api/v1";

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

interface TemporaryStructure {
  id: string;
  topFile: string;
  datFile: string;
}

const DexieDB = new Dexie("Structures") as Dexie & {
  structureData: Dexie.Table<EntryType, string>;
  remoteStructureData: Dexie.Table<EntryType, string>;
  temporaryStructure: Dexie.Table<TemporaryStructure, string>;
};

DexieDB.version(1).stores({
  structureData: "id, structureName",
  remoteStructureData: "id, structureName",
  temporaryStructure: "id",
});

(window as any).DexieDB = DexieDB;
(window as any).apiRoot = apiRoot;
