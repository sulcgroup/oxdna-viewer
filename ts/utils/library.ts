/// <reference path="../typescript_definitions/oxView.d.ts" />
/// <reference path="../typescript_definitions/index.d.ts" />

import Dexie from "https://cdn.skypack.dev/dexie";
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

const db = new Dexie("Structures");
db.version(1).stores({
  structureData: "id, structureName", // updated schema to match your interface
});

// Helper to get our table with proper type information.
const structureData = db.table<EntryType>("structureData");

interface LibraryItem {
  name: string;
  date: number;
  id: string;
}

// Async function that simulates fetching the data.
async function fetchLibraryData(): Promise<LibraryItem[]> {
  const allStructures = await structureData.toArray();
  return allStructures.map((i) => {
    return {
      name: i.structureName,
      date: i.date,
      id: i.id,
    };
  });
}

function createCard(item: LibraryItem): HTMLElement {
  // Create the card element
  const card = document.createElement("div");
  card.className = "library-card";

  // Create a paragraph for the name
  const nameP = document.createElement("p");
  nameP.textContent = item.name;

  // Create a paragraph for the last edited date
  const dateP = document.createElement("p");
  dateP.textContent = `Last edited ${new Date(item.date).getDate()}`;

  // Append the paragraphs to the card
  card.appendChild(nameP);
  card.appendChild(dateP);

  // Create a delete button
  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Delete";
  // Prevent the click from triggering the anchor navigation.
  deleteBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    event.preventDefault();
    deleteStructure(item.id);
  });
  card.appendChild(deleteBtn);

  // Create an anchor element and set its href to include the item's id
  const link = document.createElement("a");
  link.href = `/?structureId=${item.id}&load=true`;
  // Append the card into the anchor so the entire card is clickable
  link.appendChild(card);

  return link;
}

function deleteStructure(id: string) {
  // Delete the structure with the provided id.
  structureData
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
  // Clear the existing library container
  const container = document.getElementById("library-container");
  if (container) {
    container.innerHTML = "";
  }

  // Fetch the updated list of structures from Dexie
  structureData
    .toArray()
    .then((items: EntryType[]) => {
      items.forEach((item) => {
        const cardElement = createCard({
          date: item.date,
          id: item.id,
          name: item.structureName,
        });
        container?.appendChild(cardElement);
      });
    })
    .catch((error: any) => {
      console.error("Failed to refresh library cards:", error);
    });
}

async function initLibrary() {
  const container = document.getElementById("library-container");
  if (!container) return;

  try {
    const data = await fetchLibraryData();
    data.forEach((item) => {
      const card = createCard(item);
      container.appendChild(card);
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
      await structureData.add({
        id: newId,
        structure: [],
        structureName: nameElement.value,
        date: Date.now(),
      });
      // Redirect to the new structure's page using its ID.
      window.location.href = `/?structureId=${newId}`;
    }
  } catch (error) {
    console.error("Error creating a new structure:", error);
  }
}

(() => {
  console.log("hello");
})();

initLibrary();

(window as any).createNew = createNew;
