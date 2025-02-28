/// <reference path="../typescript_definitions/oxView.d.ts" />
/// <reference path="../typescript_definitions/index.d.ts" />

import Dexie from "https://cdn.skypack.dev/dexie";

interface EntryType {
  id?: number;
  structure: { data: ArrayBuffer[] };
  name: string;
  date: number;
}

const db = new Dexie("Structures");
db.version(1).stores({
  structureData: "++id, name", // auto-increment primary key
});

// Helper to get our table with proper type information.
const structureData = db.table<EntryType>("structureData");
interface LibraryItem {
  name: string;
  date: number;
  id: number;
}

// Async function that simulates fetching the data.
async function fetchLibraryData(): Promise<LibraryItem[]> {
  const allStructures = await structureData.toArray();
  return allStructures.map((i) => {
    return {
      name: i.name,
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

function deleteStructure(id: number) {
  // Assuming "db" is your Dexie instance and "structures" is your table
  structureData.delete(id)
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
  structureData.toArray()
    .then((items: EntryType[]) => {
      items.forEach(item => {
        const cardElement = createCard({
          date:item.date,
          id:item.id,
          name:item.name, 
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
      const newId = await structureData.add({
        structure: { data: [] },
        name: nameElement.value,
        date: Date.now(),
      });
      // Redirect to the new structure's page using its ID.
      window.location.href = `/?structureId=${newId}`;
    }
    // Create a new structure with an empty data array.
  } catch (error) {
    console.error("Error creating a new structure:", error);
  }
}

initLibrary();

(window as any).createNew = createNew;
