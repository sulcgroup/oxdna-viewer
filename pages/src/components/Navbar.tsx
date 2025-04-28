import { decode } from "jsonwebtoken";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

type User = { name: string; id: string };

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);

  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      if (pathname !== "/sign-in") navigate("/sign-in");
      return;
    }

    try {
      const { exp, name, id } = decode(token) as {
        exp: number;
        name: string;
        id: string;
      };
      if (Date.now() < exp * 1000) {
        setUser({ name, id });
      } else {
        if (pathname !== "/sign-in") navigate("/sign-in");
      }
    } catch {
      if (pathname !== "/sign-in") navigate("/sign-in");
    }
  }, [navigate, pathname]);

  return (
    <nav style={{ padding: "1rem", borderBottom: "1px solid #ccc" }}>
      <Link to="/dist/pages/server-status/" style={{ marginRight: "1rem" }}>
        Server Status
      </Link>
      <Link to="/dist/pages/job-status/" style={{ marginRight: "1rem" }}>
        Job Status
      </Link>
      <Link to="/dist/pages/" style={{ marginRight: "1rem" }}>
        Submit a job
      </Link>
      {user && <span>Signed in as {user.name}</span>}
    </nav>
  );
}
