/// <reference path="../typescript_definitions/oxView.d.ts" />
/// <reference path="../typescript_definitions/index.d.ts" />

import Dexie from "https://cdn.skypack.dev/dexie";
import { deflate, inflate } from "https://cdn.skypack.dev/pako";

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

export function createCompressedOxViewFile(
  space?: string | number,
): Uint8Array {
  // Prepare your data object
  const data = {
    date: new Date(),
    box: box.toArray(),
    systems,
    forces: forceHandler.forces,
    selections: selectionListHandler.serialize(),
  };

  const jsonString = JSON.stringify(data, null, space);
  return deflate(jsonString, { level: 9 });
}

export async function saveStructure(): Promise<void> {
  try {
    const compressedData = createCompressedOxViewFile();
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);

    if (urlParams.has("structureId")) {
      const id = parseInt(urlParams.get("structureId") as string, 10);
      if (!isNaN(id)) {
        const old = await structureData.get(id);
        if (old) {
          const newDataArray = [...old.structure.data, compressedData];
          await structureData.put({
            id,
            structure: {
              data: newDataArray,
            },
            date: old.date,
            name: old.name,
          });
        } else {
          console.error("Invalid structure id parameter.");
        }
      } else {
        console.log("ID parameter not found.");
      }
    }
  } catch (error) {
    console.error("Error saving structure:", error);
  }
}

export async function loadStructure(): Promise<void> {
  try {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);

    if (urlParams.has("structureId")) {
      const id = parseInt(urlParams.get("structureId") as string, 10);
      if (!isNaN(id)) {
        const storedData = await structureData.get(id);
        if (!storedData) {
          console.error(`No structure found with id ${id}.`);
          return;
        }

        const { data } = storedData.structure;
        if (data.length === 0) {
          console.error("No compressed data available in this structure.");
          return;
        }
        const compData = new Uint8Array(data[data.length - 1]);
        const uncompressed = inflate(compData, { to: "string" });
        const file = new File([uncompressed], "output.oxview", {
          type: "text/plain",
        });
        handleFiles([file]);
      } else {
        console.error("Invalid structure id parameter.");
      }
    } else {
      console.log("ID parameter not found.");
    }
  } catch (error) {
    console.error("Error loading structure:", error);
  }
}

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
if (urlParams.has("load")) {
  const shouldLoad = urlParams.get("load") === "true";

  if (shouldLoad) {
    loadStructure();
  }
}

(window as any).saveStructure = saveStructure;
(window as any).loadStructure = loadStructure;
