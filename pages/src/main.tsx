import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Root from "./App";
import { BrowserRouter, Routes, Route } from "react-router";
import SignIn from "./sign-in";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/dist/pages/" element={<Root />} />
        <Route path="/dist/pages/sign-in/" element={<SignIn />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
