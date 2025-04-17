import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { BrowserRouter, Routes, Route } from "react-router";
import SignIn from "./sign-in";
import ServerStatus from "./server-status";
import RootPage from "./root";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/dist/pages/" element={<RootPage />} />
        <Route path="/dist/pages/sign-in/" element={<SignIn />} />
        <Route path="/dist/pages/server-status/" element={<ServerStatus />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
