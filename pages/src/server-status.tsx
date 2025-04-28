import { useEffect, useState } from "react";
import { Button } from "@headlessui/react";
import { status_giver } from "./consts";
// import { apiRoot } from "./consts";

export type status_item = {
  node_id: string;
  node_name: string;
  gpu: {
    total: number;
    left: number;
  };
  cpu: {
    total: number;
    left: number;
  };
  ram: {
    total: number;
    left: number;
  };
};

export default function ServerStatusPage() {
  const [statusItems, setStatusItems] = useState<status_item[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchStatus = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const data = status_giver();
      setStatusItems(data);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        err.message || "Failed to load server status. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div className="flex min-h-screen justify-center bg-gray-100 p-4">
      <div className="w-full max-w-4xl rounded-lg bg-white p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Server Status</h1>
          <Button
            onClick={fetchStatus}
            disabled={loading}
            className={`relative flex items-center rounded-lg bg-black px-4 py-2 text-white duration-200 hover:-translate-y-1 hover:shadow-xl ${
              loading
                ? "cursor-not-allowed opacity-70 hover:translate-y-0 hover:shadow-none"
                : ""
            }`}
          >
            {loading && (
              <svg
                className="mr-2 -ml-1 h-5 w-5 animate-spin text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
            )}
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded bg-red-100 p-3 text-red-700">
            {errorMessage}
          </div>
        )}

        {statusItems.map((item) => (
          <div
            key={item.node_id}
            className="mb-6 rounded-lg border border-gray-200 p-4"
          >
            <h2 className="mb-2 text-xl font-semibold">{item.node_name}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { label: "GPU", ...item.gpu },
                { label: "CPU", ...item.cpu },
                { label: "RAM", ...item.ram },
              ].map(({ label, total, left }) => {
                const used = total - left;
                const pct = total > 0 ? Math.round((used / total) * 100) : 0;
                return (
                  <div key={label} className="space-y-1">
                    <div className="flex justify-between text-sm font-medium text-gray-700">
                      <span>{label}</span>
                      <span>
                        {left} / {total} free
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-3 bg-blue-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {statusItems.length === 0 && !loading && !errorMessage && (
          <p className="text-center text-gray-500">No nodes found.</p>
        )}
      </div>
    </div>
  );
}
