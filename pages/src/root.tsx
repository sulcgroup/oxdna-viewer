import { useState, ChangeEvent, FormEvent, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
} from "@headlessui/react";
import { apiRoot } from "./consts";
import { useNavigate } from "react-router-dom";

const NUMBER_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
interface FormData {
  job_name: string;
  method: "MC" | "MD";
  type: boolean;
  steps: string;
  e_t_print_interval: string;
  dt: number;
  interaction_type: number;
  h_bon_restrain: boolean;
  temperature: number;
  salt_concentration: number;
  verlet: number;
  advancedOptions: string;
}

const interactionTypeOptions = [
  { name: "DNA2", value: 0 },
  { name: "RNA2", value: 1 },
  { name: "Lorenzo Patchy", value: 2 },
  { name: "Romano Patchy", value: 3 },
  { name: "Subhajit Patchy", value: 4 },
  { name: "PHB", value: 5 },
  { name: "PSP", value: 6 },
  { name: "Umbrella Sampling", value: 7 },
  { name: "Forward Flux", value: 8 },
];

export default function RootPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const { exp } = jwtDecode(token) as {
          exp: number;
          name: string;
          id: string;
        };
        if (Date.now() > exp * 1000) {
          navigate("/dist/pages/sign-in");
        }
      } catch (e) {
        console.log(e);
      }
    } else {
      navigate("/dist/pages/sign-in");
    }
  }, []);

  const [formData, setFormData] = useState<FormData>({
    job_name: "",
    method: "MC",
    type: false,
    steps: "1e5",
    e_t_print_interval: "1e3",
    dt: 0.003,
    interaction_type: 0,
    h_bon_restrain: false,
    temperature: 25,
    salt_concentration: 1,
    verlet: 0.6,
    advancedOptions: "",
  });

  const [topFile, setTopFile] = useState<File | null>(null);
  const [datFile, setDatFile] = useState<File | null>(null);
  const [forceFile, setForceFile] = useState<File | null>(null);

  // Field‑level errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Server/auth errors
  const [globalError, setGlobalError] = useState<string | null>(null);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleMethodChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      method: e.target.value as "MC" | "MD",
    }));
  };

  const handleRadioChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      type: e.target.value === "true",
    }));
  };

  const handleInteractionTypeChange = (value: number) => {
    setFormData((prev) => ({
      ...prev,
      interaction_type: value,
    }));
  };

  const handleTopFileChange = (e: ChangeEvent<HTMLInputElement>) =>
    setTopFile(e.target.files?.[0] || null);
  const handleDatFileChange = (e: ChangeEvent<HTMLInputElement>) =>
    setDatFile(e.target.files?.[0] || null);
  const handleForceFileChange = (e: ChangeEvent<HTMLInputElement>) =>
    setForceFile(e.target.files?.[0] || null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGlobalError(null);

    const newErrors: Record<string, string> = {};

    if (!topFile) newErrors.topFile = "Top File is required.";
    if (!datFile) newErrors.datFile = "Dat File is required.";

    let parsedSteps;
    let parsedInterval;
    if (!NUMBER_RE.test(formData.steps)) {
      newErrors.steps =
        "Invalid input for Steps. Must be a valid number (e.g. 1000 or 1e5).";
    } else {
      parsedSteps = parseFloat(formData.steps);
    }
    if (!NUMBER_RE.test(formData.e_t_print_interval)) {
      newErrors.e_t_print_interval =
        "Invalid input for E_T Print Interval. Must be a valid number (e.g. 100 or 1e3).";
    } else {
      parsedInterval = parseFloat(formData.e_t_print_interval);
    }

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }

    // Build payload
    const payload = new FormData();
    payload.append("job_name", formData.job_name);
    payload.append("method", formData.method);
    payload.append("type", String(formData.type));
    payload.append("steps", String(parsedSteps));
    payload.append("e_t_print_interval", String(parsedInterval));
    payload.append("dt", String(formData.dt));
    payload.append("interaction_type", String(formData.interaction_type));
    payload.append("h_bon_restrain", String(formData.h_bon_restrain));
    payload.append("temperature", String(formData.temperature));
    payload.append("salt_concentration", String(formData.salt_concentration));
    payload.append("verlet", String(formData.verlet));
    payload.append("advancedOptions", formData.advancedOptions);
    payload.append("top", topFile!);
    payload.append("dat", datFile!);
    if (forceFile) payload.append("forces", forceFile);

    const token = localStorage.getItem("token");
    if (!token) {
      setGlobalError("Authentication token is missing. Please log in.");
      return;
    }

    try {
      const res = await fetch(`${apiRoot}/jobs/create-job`, {
        method: "POST",
        body: payload,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.json();
        throw new Error(text || "Unknown server error");
      }
      alert("Job submitted successfully!");
    } catch (err: any) {
      setGlobalError(err.message || "Failed to submit job.");
    }
  };

  return (
    <div className="flex min-h-screen justify-center p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8">
        <h1 className="mb-6 text-center text-3xl font-bold">Submit New Job</h1>

        {globalError && (
          <div className="mb-4 rounded border border-red-300 bg-red-100 p-3 text-red-700">
            {globalError}
          </div>
        )}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="job_name"
              className="block text-sm font-medium text-gray-700"
            >
              Job name
            </label>
            <input
              id="jobs_name"
              name="job_name"
              type="text"
              placeholder="My job"
              value={formData.job_name}
              onChange={handleChange}
              className={`mt-1 block w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500`}
            />
          </div>

          {/* Simulation Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Simulation Mode
            </label>
            <div className="mt-1 flex items-center space-x-4">
              <div className="flex items-center">
                <input
                  id="modeMC"
                  name="method"
                  type="radio"
                  value="MC"
                  checked={formData.method === "MC"}
                  onChange={handleMethodChange}
                  className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="modeMC" className="ml-2 text-gray-700">
                  MC
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="modeMD"
                  name="method"
                  type="radio"
                  value="MD"
                  checked={formData.method === "MD"}
                  onChange={handleMethodChange}
                  className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="modeMD" className="ml-2 text-gray-700">
                  MD
                </label>
              </div>
            </div>
          </div>

          {/* Compute Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Compute Type
            </label>
            <div className="mt-1 flex items-center space-x-4">
              <div className="flex items-center">
                <input
                  id="typeCPU"
                  name="type"
                  type="radio"
                  value="true"
                  checked={formData.type === true}
                  onChange={handleRadioChange}
                  className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="typeCPU" className="ml-2 text-gray-700">
                  CPU
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="typeGPU"
                  name="type"
                  type="radio"
                  value="false"
                  checked={formData.type === false}
                  onChange={handleRadioChange}
                  disabled={formData.method === "MC"}
                  className={`h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500 ${
                    formData.method === "MC" ? "cursor-not-allowed" : ""
                  }`}
                  title={
                    formData.method === "MC"
                      ? "MC cannot be run on GPU"
                      : undefined
                  }
                />
                <label
                  htmlFor="typeGPU"
                  className={`ml-2 ${
                    formData.method === "MC"
                      ? "cursor-not-allowed text-gray-400"
                      : "text-gray-700"
                  }`}
                  title={
                    formData.method === "MC"
                      ? "MC cannot be run on GPU"
                      : undefined
                  }
                >
                  GPU
                </label>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div>
            <label
              htmlFor="steps"
              className="block text-sm font-medium text-gray-700"
            >
              Steps
            </label>
            <input
              id="steps"
              name="steps"
              type="text"
              placeholder="e.g., 1e5"
              value={formData.steps}
              onChange={handleChange}
              className={`mt-1 block w-full rounded-md border p-2 focus:border-blue-500 focus:ring-blue-500 ${
                errors.steps ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.steps && (
              <p className="mt-1 text-sm text-red-600">{errors.steps}</p>
            )}
          </div>

          {/* E_T Print Interval */}
          <div>
            <label
              htmlFor="e_t_print_interval"
              className="block text-sm font-medium text-gray-700"
            >
              E_T Print Interval
            </label>
            <input
              id="e_t_print_interval"
              name="e_t_print_interval"
              type="text"
              placeholder="e.g., 1e3"
              value={formData.e_t_print_interval}
              onChange={handleChange}
              className={`mt-1 block w-full rounded-md border p-2 focus:border-blue-500 focus:ring-blue-500 ${
                errors.e_t_print_interval ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.e_t_print_interval && (
              <p className="mt-1 text-sm text-red-600">
                {errors.e_t_print_interval}
              </p>
            )}
          </div>

          {/* dt */}
          <div>
            <label
              htmlFor="dt"
              className="block text-sm font-medium text-gray-700"
            >
              dt
            </label>
            <input
              id="dt"
              name="dt"
              type="text"
              value={formData.dt}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          {/* Interaction Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Interaction Type
            </label>
            <Listbox
              value={formData.interaction_type}
              onChange={handleInteractionTypeChange}
            >
              <div className="relative mt-1">
                <ListboxButton className="w-full cursor-default rounded-md border border-gray-300 bg-white py-2 pr-10 pl-3 text-left shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm">
                  {
                    interactionTypeOptions.find(
                      (o) => o.value === formData.interaction_type
                    )?.name
                  }
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                    <svg
                      className="h-5 w-5 text-gray-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0L5.23 8.23a.75.75 0 01.02-1.02z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                </ListboxButton>
                <ListboxOptions className="ring-opacity-5 absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black focus:outline-none sm:text-sm">
                  {interactionTypeOptions.map((option) => (
                    <ListboxOption
                      key={option.value}
                      value={option.value}
                      className={({ active }) =>
                        `relative cursor-default py-2 pr-4 pl-10 select-none ${
                          active ? "bg-blue-100 text-blue-900" : "text-gray-900"
                        }`
                      }
                    >
                      {({ selected }) => (
                        <>
                          <span
                            className={`block truncate ${
                              selected ? "font-medium" : "font-normal"
                            }`}
                          >
                            {option.name}
                          </span>
                          {selected && (
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                              <svg
                                className="h-5 w-5"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                aria-hidden="true"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l4 4 7.473-9.817a.75.75 0 011.05-.143z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </span>
                          )}
                        </>
                      )}
                    </ListboxOption>
                  ))}
                </ListboxOptions>
              </div>
            </Listbox>
          </div>

          {/* Hydrogen Bond Restrain */}
          <div className="flex items-center">
            <input
              id="h_bon_restrain"
              name="h_bon_restrain"
              type="checkbox"
              checked={formData.h_bon_restrain}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label
              htmlFor="h_bon_restrain"
              className="ml-2 text-sm text-gray-700"
            >
              Hydrogen Bond Restrain
            </label>
          </div>

          {/* Temperature */}
          <div>
            <label
              htmlFor="temperature"
              className="block text-sm font-medium text-gray-700"
            >
              Temperature
            </label>
            <input
              id="temperature"
              name="temperature"
              type="number"
              value={formData.temperature}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          {/* Salt Concentration */}
          <div>
            <label
              htmlFor="salt_concentration"
              className="block text-sm font-medium text-gray-700"
            >
              Salt Concentration
            </label>
            <input
              id="salt_concentration"
              name="salt_concentration"
              type="number"
              value={formData.salt_concentration}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          {/* Verlet */}
          <div>
            <label
              htmlFor="verlet"
              className="block text-sm font-medium text-gray-700"
            >
              Verlet
            </label>
            <input
              id="verlet"
              name="verlet"
              type="number"
              value={formData.verlet}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          {/* Advanced Options */}
          <details>
            <summary className="cursor-pointer text-sm font-medium text-gray-700">
              Advanced Options (one per line)
            </summary>
            <div className="mt-2">
              <textarea
                id="advancedOptions"
                name="advancedOptions"
                rows={3}
                value={formData.advancedOptions}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
          </details>

          {/* File Inputs */}
          <div>
            <label
              htmlFor="topFile"
              className="block text-sm font-medium text-gray-700"
            >
              Top File <span className="text-red-500">*</span>
            </label>
            <input
              id="topFile"
              type="file"
              onChange={handleTopFileChange}
              className={`mt-1 block w-full ${
                errors.topFile ? "border border-red-500" : ""
              }`}
            />
            {errors.topFile && (
              <p className="mt-1 text-sm text-red-600">{errors.topFile}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="datFile"
              className="block text-sm font-medium text-gray-700"
            >
              Dat File <span className="text-red-500">*</span>
            </label>
            <input
              id="datFile"
              type="file"
              onChange={handleDatFileChange}
              className={`mt-1 block w-full ${
                errors.datFile ? "border border-red-500" : ""
              }`}
            />
            {errors.datFile && (
              <p className="mt-1 text-sm text-red-600">{errors.datFile}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="forceFile"
              className="block text-sm font-medium text-gray-700"
            >
              Force File (optional)
            </label>
            <input
              id="forceFile"
              type="file"
              onChange={handleForceFileChange}
              className="mt-1 block w-full"
            />
          </div>

          {/* Submit */}
          <div>
            <button
              type="submit"
              className="w-full rounded-lg bg-black px-4 py-2 text-white hover:shadow-xl"
            >
              Submit Job
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
