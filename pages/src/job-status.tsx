import { useEffect, useState } from "react";
import { Button } from "@headlessui/react";
import { apiRoot } from "./consts";

export type JobStatus = {
  active: number;
  runningTime: number;
  progress: number;
  job_name: string;
  stepsCompleted: number;
  job_id: string;
};

const get_all_job_ids = async (): Promise<string[]> => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${apiRoot}/jobs/get-all-job-ids`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  const json = await res.json();

  return json.job_ids;
};

const stats_fetcher = async (job_id: string) => {
  console.log({ job_id });
  const token = localStorage.getItem("token");
  if (!token) {
    return;
  }

  const res = await fetch(`${apiRoot}/jobs/get-job-status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      job_id,
    }),
  });

  const json = await res.json();
  return json;
};

export default function JobStatusPage() {
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchJobs = async () => {
    setLoading(true);
    setError("");
    try {
      const ids = await get_all_job_ids();
      const answers: JobStatus[] = [];
      for (const id of ids) {
        const aaa = await stats_fetcher(id);
        jobs.push(aaa);
      }
      setJobs(answers);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to load job statuses.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  return (
    <div className="flex min-h-screen justify-center bg-gray-100 p-4">
      <div className="w-full max-w-4xl rounded-lg bg-white p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Job Statuses</h1>
          <Button
            onClick={fetchJobs}
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

        {error && (
          <div className="mb-4 rounded bg-red-100 p-3 text-red-700">
            {error}
          </div>
        )}

        {jobs.map((job) => (
          <div
            key={job.job_id}
            className="mb-6 rounded-lg border border-gray-200 p-4"
          >
            <h2 className="mb-2 text-xl font-semibold">{job.job_name}</h2>
            <div className="mb-2 flex items-center justify-between text-sm text-gray-700">
              <span>Running time:</span>
              <span>{job.runningTime}</span>
            </div>
            <div className="mb-1 flex items-center justify-between text-sm font-medium text-gray-700">
              <span>Progress</span>
              <span>{job.progress}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-3 bg-blue-500"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>
        ))}

        {jobs.length === 0 && !loading && !error && (
          <p className="text-center text-gray-500">No jobs found.</p>
        )}
      </div>
    </div>
  );
}
