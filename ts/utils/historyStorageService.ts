/// <reference path="../typescript_definitions/oxView.d.ts" />
/// <reference path="../typescript_definitions/index.d.ts" />

import { deflate, inflate } from "https://cdn.skypack.dev/pako";

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
    const commitNameElement = document.getElementById(
      "commitName",
    ) as HTMLInputElement;

    if (!commitNameElement || commitNameElement.value === "") {
      alert("No commit name given");
      return;
    }
    const compressedData = createCompressedOxViewFile();
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);

    if (urlParams.has("structureId")) {
      const id = urlParams.get("structureId") as string;
      if (id) {
        const old = await (window as any).DexieDB.structureData.get(id);
        if (old) {
          const newDataArr: { data: ArrayBuffer; commitName: string }[] = [
            ...old.structure,
            { data: compressedData, commitName: commitNameElement.value },
          ];

          await (window as any).DexieDB.structureData.put({
            id,
            structure: newDataArr,
            date: old.date,
            structureName: old.structureName,
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
      if (urlParams.has("commit")) {
        const id = urlParams.get("structureId") as string;
        if (id) {
          const storedData = await (window as any).DexieDB.structureData.get(
            id,
          );
          if (!storedData) {
            console.error(`No structure found with id ${id}.`);
            return;
          }

          const data = storedData.structure;
          if (data.length === 0) {
            console.error("No compressed data available in this structure.");
            return;
          }
          const compData = new Uint8Array(
            data.find((i) => i.commitName === urlParams.get("commit")).data,
          );
          const uncompressed = inflate(compData, { to: "string" });
          const file = new File([uncompressed], "output.oxview", {
            type: "text/plain",
          });
          view.inboxingMode.set("None");
          view.centeringMode.set("None");

          handleFiles([file]);
        } else {
          console.error("Invalid structure id parameter.");
        }
      } else {
        const id = urlParams.get("structureId") as string;
        if (id) {
          const storedData = await (window as any).DexieDB.structureData.get(
            id,
          );
          if (!storedData) {
            console.error(`No structure found with id ${id}.`);
            return;
          }

          const data = storedData.structure;
          if (data.length === 0) {
            console.error("No compressed data available in this structure.");
            return;
          }
          const compData = new Uint8Array(data[data.length - 1].data);
          const uncompressed = inflate(compData, { to: "string" });
          const file = new File([uncompressed], "output.oxview", {
            type: "text/plain",
          });
          handleFiles([file]);
        } else {
          console.error("Invalid structure id parameter.");
        }
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

async function viewHistory() {
  // Get the structureId query parameter from the URL
  const params = new URLSearchParams(window.location.search);
  const structureIdParam = params.get("structureId");

  if (!structureIdParam) {
    console.error("No structureId query parameter found in the URL.");
    return;
  }

  // Convert the parameter to a number (assuming your ids are numeric)
  const structureId = structureIdParam;

  try {
    // Retrieve the entry from the Dexie database by its id
    const entry = await (window as any).DexieDB.structureData.get(structureId);

    if (!entry) {
      console.error(`No entry found for structureId: ${structureId}`);
      return;
    }

    // Find the div where the links will be inserted
    const commitListDiv = document.getElementById("commitList");
    if (!commitListDiv) {
      console.error("Div with id 'commitList' not found.");
      return;
    }

    // Clear any existing content in the div
    commitListDiv.innerHTML = "";

    // Loop through each commit in the entry's structure array and create an <a> element
    entry.structure.forEach((commit) => {
      const link = document.createElement("a");
      // Here you can set the href as needed; currently it is set to '#' as a placeholder.
      link.href = `/?structureId=${structureId}&load=true&commit=${commit.commitName}`;
      link.textContent = commit.commitName;

      // Optionally, wrap each link in a div or add a line break for formatting
      const lineBreak = document.createElement("br");

      // Append the link and line break to the target div
      commitListDiv.appendChild(link);
      commitListDiv.appendChild(lineBreak);
    });
  } catch (error) {
    console.error("Error retrieving data from Dexie DB:", error);
  }
}

async function pushToServer() {
  try {
    // Get the structureId query parameter from the URL
    const params = new URLSearchParams(window.location.search);
    const structureIdParam = params.get("structureId");

    if (!structureIdParam) {
      console.error("No structureId query parameter found in the URL.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Authentication token is missing. Please log in.");
    }
    const response = await fetch(`${apiRoot}/oxview/save-structure`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        structureId: structureIdParam,
      }),
    });

    // Convert the parameter to a number (assuming your ids are numeric)
    const structureId = structureIdParam;

    // Retrieve the entry from the Dexie database by its id
    const entry = await (window as any).DexieDB.structureData.get(structureId);

    if (!entry) {
      console.error(`No entry found for structureId: ${structureId}`);
      return;
    }

    // Find the div where the links will be inserted
    const commitListDiv = document.getElementById("commitList");
    if (!commitListDiv) {
      console.error("Div with id 'commitList' not found.");
      return;
    }

    // Clear any existing content in the div
    commitListDiv.innerHTML = "";

    // Loop through each commit in the entry's structure array and create an <a> element
    entry.structure.forEach((commit: { commitName: string }) => {
      const link = document.createElement("a");
      // Here you can set the href as needed; currently it is set to '#' as a placeholder.
      link.href = `/?structureId=${structureId}&load=true&commit=${commit.commitName}`;
      link.textContent = commit.commitName;

      // Optionally, wrap each link in a div or add a line break for formatting
      const lineBreak = document.createElement("br");

      // Append the link and line break to the target div
      commitListDiv.appendChild(link);
      commitListDiv.appendChild(lineBreak);
    });
  } catch (error) {
    console.error("Error retrieving data from Dexie DB:", error);
  }
}

(window as any).saveStructure = saveStructure;
(window as any).loadStructure = loadStructure;
(window as any).viewHistory = viewHistory;
(window as any).pushToServer = pushToServer;
