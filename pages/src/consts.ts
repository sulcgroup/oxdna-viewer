export const apiRoot =
  process.env.NODE_ENV === "production"
    ? "https://api.nanobase.org/api/v1"
    : "http://localhost:3002/api/v1";
//export const apiRoot = "http://localhost:3002/api/v1";
