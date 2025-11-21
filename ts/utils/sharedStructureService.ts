/// <reference path="../typescript_definitions/oxView.d.ts" />
/// <reference path="../typescript_definitions/index.d.ts" />

import { inflate } from "https://cdn.skypack.dev/pako";

interface SharedStructureResponse {
  success: boolean;
  structure: {
    structureName: string;
    commitId: string;
    commitName: string;
    data: string; // Base64 encoded compressed data
    parent: string | null;
    createdAt: string;
  };
}

/**
 * Loads a shared structure from the backend API
 */
async function loadSharedStructure(shareId: string): Promise<void> {
  try {
    console.log(`loadSharedStructure: Loading shared structure with ID: ${shareId}`);
    const apiRoot = window.getAPIBaseURL();

    const response = await fetch(`${apiRoot}/share/commit/${shareId}`);

    if (!response.ok) {
      if (response.status === 404) {
        alert("Shared structure not found or has expired.");
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const sharedData: SharedStructureResponse = await response.json();
    console.log("loadSharedStructure: Retrieved shared data:", sharedData);

    // Convert base64 back to compressed data
    const binaryString = atob(sharedData.structure.data); // Keep original API response field name
    const compressedData = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      compressedData[i] = binaryString.charCodeAt(i);
    }

    // Decompress the data
    console.log("loadSharedStructure: Decompressing data...");
    const uncompressed = inflate(compressedData, { to: "string" });

    // Create a File object from the decompressed data
    console.log("loadSharedStructure: Creating File object...");
    const file = new File([uncompressed], "shared_structure.oxview", { // Keep original filename
      type: "text/plain",
    });

    // Load the structure into the viewer
    console.log("loadSharedStructure: Loading into viewer...");
    view.inboxingMode.set("None");
    view.centeringMode.set("None");
    handleFiles([file]);

    // Show info about the shared structure
    const createdAt = new Date(sharedData.structure.createdAt); // Keep original API response field name

    console.log(`loadSharedStructure: Loaded shared structure "${sharedData.structure.structureName}" created on ${createdAt.toLocaleDateString()}`); // Keep original API response field name

    // Optional: Show a notification to the user
    if ((window as any).notify) {
      (window as any).notify(
        `Loaded shared structure: "${sharedData.structure.structureName}" (${sharedData.structure.commitName})`, // Keep original API response field name
        'info'
      );
    }

  } catch (error) {
    console.error("loadSharedStructure: Error loading shared structure:", error); // Keep original error message
    alert("Failed to load shared structure. Please check the link and try again."); // Keep original error message
  }
}

/**
 * Check if the current URL is for a shared structure and load it
 */
function checkForSharedStructure(): void {
  const urlParams = new URLSearchParams(window.location.search);
  const shareId = urlParams.get("shareId");

  if (shareId) {
    console.log(`checkForSharedStructure: Found shared structure ID: ${shareId}`);
    loadSharedStructure(shareId);
  }
}

// Auto-check for shared structures when the script loads
checkForSharedStructure();

// Make functions available globally
(window as any).loadSharedStructure = loadSharedStructure;
(window as any).checkForSharedStructure = checkForSharedStructure;
