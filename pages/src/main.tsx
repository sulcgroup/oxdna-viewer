import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { BrowserRouter, Routes, Route } from "react-router";
import SignIn from "./sign-in";
import ServerStatus from "./server-status";
import RootPage from "./root";
import JobStatusPage from "./job-status";
import Navbar from "./components/Navbar";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/dist/pages/" element={<RootPage />} />
        <Route path="/dist/pages/sign-in/" element={<SignIn />} />
        <Route path="/dist/pages/server-status/" element={<ServerStatus />} />
        <Route path="/dist/pages/job-status/" element={<JobStatusPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
