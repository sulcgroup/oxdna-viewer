import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

type DecodedToken = {
  exp: number;
  name: string;
  id: string;
};

type User = { name: string; id: string };

/** Parses a JWT’s payload (no validation!) */
function parseJwt<T = any>(token: string): T {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT");
  // base64url → base64
  const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  // atob + decodeURIComponent to handle utf-8
  const json = decodeURIComponent(
    atob(b64)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
  return JSON.parse(json);
}

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      if (!pathname.includes("/dist/pages/sign-in")) {
        navigate("/dist/pages/sign-in/");
      }
      return;
    }

    let decoded: DecodedToken;
    try {
      decoded = parseJwt<DecodedToken>(token);
    } catch {
      if (!pathname.includes("/dist/pages/sign-in")) {
        navigate("/dist/pages/sign-in/");
      }
      return;
    }

    const { exp, name, id } = decoded;
    if (Date.now() < exp * 1000) {
      setUser({ name, id });
    } else {
      // expired
      if (!pathname.includes("/dist/pages/sign-in")) {
        navigate("/dist/pages/sign-in/");
      }
    }
  }, [navigate, pathname]);

  return (
    <nav className="relative flex items-center border-b border-gray-300 p-4">
      <div className="mx-auto flex space-x-6">
        <Link to="/dist/pages/server-status/" className="font-bold underline">
          Server Status
        </Link>
        <Link to="/dist/pages/job-status/" className="font-bold underline">
          Job Status
        </Link>
        <Link to="/dist/pages/" className="font-bold underline">
          Submit a job
        </Link>
      </div>

      {user && (
        <span className="absolute right-4">Signed in as {user.name}</span>
      )}
    </nav>
  );
}
