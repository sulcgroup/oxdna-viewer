export async function generateAndStoreCurrentStructure() {
    try {
        const name = "temp_structure"; // Fixed name for temporary storage
        // Logic from makeOutputFiles to get file contents
        const [newElementIDs, newStrandIds, counts, gsSubtypes] = window.getNewIds(true); // Assuming new format for consistency
        const { file: topFileContent } = window.makeTopFile(name, newElementIDs, newStrandIds, gsSubtypes, counts, true);
        const { file: datFileContent } = window.makeDatFile(name, newElementIDs);
        await window.DexieDB.temporaryStructure.put({
            id: "currentStructure",
            topFile: topFileContent,
            datFile: datFileContent,
        });
        console.log("Top and Dat files stored in DexieDB.temporaryStructure");
    }
    catch (error) {
        console.error("Error generating or storing files:", error);
        // Optionally, notify the user
        // notify("Failed to prepare structure for jobs page.", "alert");
    }
}
// Add event listener after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const jobsLink = document.getElementById('jobsLink');
    if (jobsLink) {
        jobsLink.addEventListener('click', async (event) => {
            event.preventDefault(); // Prevent default navigation immediately
            await generateAndStoreCurrentStructure();
            window.open(jobsLink.getAttribute('href'), '_blank'); // Navigate after storage
        });
    }
});
