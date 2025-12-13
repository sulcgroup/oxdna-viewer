function createId() {
    if (typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function") {
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
        }
        else {
            r = (dt2 + r) % 16 | 0;
            dt2 = Math.floor(dt2 / 16);
        }
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
}
window.createId = createId;
