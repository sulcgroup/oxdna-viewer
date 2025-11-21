import Dexie from "https://cdn.skypack.dev/dexie";
// Class-based approach to ensure type definitions persist in compiled output
class ShareInfo {
    shareUrl;
    shareId;
    createdAt;
    expiresAt;
    constructor(shareUrl, shareId, createdAt, expiresAt) {
        this.shareUrl = shareUrl;
        this.shareId = shareId;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }
}
class CommitType {
    data;
    commitName;
    commitId;
    parent;
    createdAt;
    shareInfo;
    constructor(data, commitName, commitId, parent, shareInfo, createdAt) {
        this.data = data;
        this.commitName = commitName;
        this.commitId = commitId;
        this.parent = parent;
        this.shareInfo = shareInfo;
        this.createdAt = createdAt;
    }
}
class EntryType {
    id;
    commits; // Renamed from 'structure' to 'commits'
    structureName;
    date;
    branches;
    isSynced; // NEW: Indicates if project is synced to backend
    syncedProjectId; // NEW: References SyncedOxviewProject.id
    isRemote; // NEW: Indicates if structure should be deleted on logout
    // A cloned public project source id, if this was pulled from a public project
    publicSourceId;
    // Whether this local copy is marked as public (synced with backend)
    isPublic;
    constructor(id, commits, structureName, date, branches, isSynced, syncedProjectId, isRemote, publicSourceId, isPublic) {
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
    id;
    topFile;
    datFile;
    constructor(id, topFile, datFile) {
        this.id = id;
        this.topFile = topFile;
        this.datFile = datFile;
    }
}
const DexieDB = new Dexie("Structures");
// Version 1: Simplified schema with all current fields
DexieDB.version(1).stores({
    structureData: "id, structureName, isSynced, syncedProjectId, isRemote, publicSourceId, isPublic",
    remoteStructureData: "id, structureName, isSynced, syncedProjectId, isRemote, publicSourceId, isPublic",
    temporaryStructure: "id",
});
window.DexieDB = DexieDB;
