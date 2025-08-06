/// <reference path="../typescript_definitions/oxView.d.ts" />
/// <reference path="../typescript_definitions/index.d.ts" />

function createId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    // Modern browsers have a built-in randomUUID method.
    return crypto.randomUUID();
  }

  // Fallback to a manual implementation if crypto.randomUUID isn't available.
  let dt = new Date().getTime();
  let dt2 = (performance && performance.now && performance.now() * 1000) || 0;
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    let r = Math.random() * 16;
    if (dt > 0) {
      r = (dt + r) % 16 | 0;
      dt = Math.floor(dt / 16);
    } else {
      r = (dt2 + r) % 16 | 0;
      dt2 = Math.floor(dt2 / 16);
    }
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

interface EntryType {
  id: string;
  structure: { data: ArrayBuffer; commitName: string }[];
  structureName: string;
  date: number;
}

interface LibraryItem {
  name: string;
  date: number;
  id: string;
  latestCommitId: string;
}

// Async function that simulates fetching the data.
async function fetchLibraryData(): Promise<LibraryItem[]> {
  const allStructures = await (window as any).DexieDB.structureData.toArray();
  return allStructures.map((i) => {
    const latestCommit = i.structure[i.structure.length - 1];
    return {
      name: i.structureName,
      date: i.date,
      id: i.id,
      latestCommitId: latestCommit ? latestCommit.commitId : null,
    };
  });
}

function createCard(item: LibraryItem): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "cell-md-4";

  const link = document.createElement("a");
  if (item.latestCommitId) {
    link.href = `/?structureId=${item.id}&commit=${item.latestCommitId}&load=true`;
  }
  link.style.textDecoration = "none";
  link.style.color = "inherit";

  const card = document.createElement("div");
  card.className = "card m-2";

  const cardHeader = document.createElement("div");
  cardHeader.className = "card-header";
  cardHeader.textContent = item.name;
  card.appendChild(cardHeader);

  const cardContent = document.createElement("div");
  cardContent.className = "card-content p-2";
  cardContent.textContent = `Last edited: ${new Date(
    item.date,
  ).toLocaleDateString()}`;
  card.appendChild(cardContent);

  const cardFooter = document.createElement("div");
  cardFooter.className = "card-footer";

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Delete";
  deleteBtn.className = "button alert";
  deleteBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    event.preventDefault();
    deleteStructure(item.id);
  });
  cardFooter.appendChild(deleteBtn);

  const historyBtn = document.createElement("button");
  historyBtn.textContent = "View History";
  historyBtn.className = "button secondary";
  historyBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    view.openCommitHistoryModal(item.id);
  });
  cardFooter.appendChild(historyBtn);

  card.appendChild(cardFooter);
  link.appendChild(card);
  cell.appendChild(link);

  return cell;
}

function deleteStructure(id: string) {
  // Delete the structure with the provided id.
  (window as any).DexieDB.structureData
    .delete(id)
    .then(() => {
      console.log(`Structure with id ${id} deleted successfully.`);
      // Refresh the library cards to remove stale data
      refreshLibraryCards();
    })
    .catch((error: any) => {
      console.error(`Failed to delete structure with id ${id}:`, error);
    });
}

// Example function to refresh the library cards
function refreshLibraryCards() {
  const container = document.getElementById("library-container");
  if (!container) return;

  container.innerHTML = "";
  const row = document.createElement("div");
  row.className = "row";
  container.appendChild(row);

  // Fetch the updated list of structures from Dexie
  (window as any).DexieDB.structureData
    .toArray()
    .then((items: EntryType[]) => {
      items.forEach((item) => {
        const latestCommit =
          item.structure && item.structure.length > 0
            ? item.structure[item.structure.length - 1]
            : null;
        const libraryItem: LibraryItem = {
          date: item.date,
          id: item.id,
          name: item.structureName,
          latestCommitId: latestCommit ? (latestCommit as any).commitId : null,
        };
        const cardElement = createCard(libraryItem);
        row.appendChild(cardElement);
      });
    })
    .catch((error: any) => {
      console.error("Failed to refresh library cards:", error);
    });
}

async function initLibrary() {
  const container = document.getElementById("library-container");
  if (!container) return;

  const row = document.createElement("div");
  row.className = "row";
  container.appendChild(row);

  try {
    const data = await fetchLibraryData();
    data.forEach((item) => {
      const card = createCard(item);
      row.appendChild(card);
    });
  } catch (error) {
    console.error("Error fetching library data:", error);
  }
}

async function createNew(): Promise<void> {
  try {
    const nameElement = document.getElementById(
      "create-structure-name",
    ) as HTMLInputElement;
    if (!nameElement || nameElement.value === "") {
      alert("Please give a name");
    } else {
      const newId = createId();
      console.log("i got called", newId);
      await (window as any).DexieDB.structureData.add({
        id: newId,
        structure: [],
        structureName: nameElement.value,
        date: Date.now(),
        branches: { main: [] },
      });
      // Redirect to the new structure's page using its ID.
      window.location.href = `/?structureId=${newId}`;
    }
  } catch (error) {
    console.error("Error creating a new structure:", error);
  }
}

initLibrary();

(window as any).createNew = createNew;
