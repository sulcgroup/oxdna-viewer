import Dexie from "https://cdn.skypack.dev/dexie";


// Class-based approach to ensure type definitions persist in compiled output
class ShareInfo {
  shareUrl: string;
  shareId: string;
  createdAt: Date;
  expiresAt: Date;

  constructor(
    shareUrl: string,
    shareId: string,
    createdAt: Date,
    expiresAt: Date
  ) {
    this.shareUrl = shareUrl;
    this.shareId = shareId;
    this.createdAt = createdAt;
    this.expiresAt = expiresAt;
  }
}

class CommitType {
  data: ArrayBuffer;
  commitName: string;
  commitId: string;
  parent: string | null;
  createdAt?: number | Date;
  shareInfo?: ShareInfo;

  constructor(
    data: ArrayBuffer,
    commitName: string,
    commitId: string,
    parent: string | null,
    shareInfo?: ShareInfo,
    createdAt?: number | Date
  ) {
    this.data = data;
    this.commitName = commitName;
    this.commitId = commitId;
    this.parent = parent;
    this.shareInfo = shareInfo;
    this.createdAt = createdAt;
  }
}

class EntryType {
  id: string;
  commits: CommitType[]; // Renamed from 'structure' to 'commits'
  structureName: string;
  date: number;
  branches: { [key: string]: string[] };
  isSynced: boolean; // NEW: Indicates if project is synced to backend
  syncedProjectId: string | null; // NEW: References SyncedOxviewProject.id
  isRemote?: boolean; // NEW: Indicates if structure should be deleted on logout
  // A cloned public project source id, if this was pulled from a public project
  publicSourceId?: string;
  // Whether this local copy is marked as public (synced with backend)
  isPublic?: boolean;

  constructor(
    id: string,
    commits: CommitType[],
    structureName: string,
    date: number,
    branches: { [key: string]: string[] },
    isSynced: boolean,
    syncedProjectId: string | null,
    isRemote?: boolean,
    publicSourceId?: string,
    isPublic?: boolean
  ) {
    this.id = id;
    this.commits = commits;
    this.structureName = structureName;
    this.date = date;
    this.branches = branches;
    this.isSynced = isSynced;
    this.syncedProjectId = syncedProjectId;
    this.isRemote = isRemote;
    this.publicSourceId = publicSourceId;
    this.isPublic = isPublic;
  }
}

class TemporaryStructure {
  id: string;
  topFile: string;
  datFile: string;

  constructor(id: string, topFile: string, datFile: string) {
    this.id = id;
    this.topFile = topFile;
    this.datFile = datFile;
  }
}

const DexieDB = new Dexie("Structures") as Dexie & {
  structureData: Dexie.Table<EntryType, string>;
  remoteStructureData: Dexie.Table<EntryType, string>;
  temporaryStructure: Dexie.Table<TemporaryStructure, string>;
};

// Version 1: Simplified schema with all current fields
DexieDB.version(1).stores({
  structureData: "id, structureName, isSynced, syncedProjectId, isRemote, publicSourceId, isPublic",
  remoteStructureData: "id, structureName, isSynced, syncedProjectId, isRemote, publicSourceId, isPublic",
  temporaryStructure: "id",
});

(window as any).DexieDB = DexieDB;
