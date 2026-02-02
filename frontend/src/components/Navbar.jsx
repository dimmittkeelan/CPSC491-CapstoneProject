import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav style={{ display: "flex", gap: 12, padding: 16 }}>
      <Link to="/">Home</Link>
      <Link to="/build">Build</Link>
      <Link to="/saved">Saved</Link>
      <Link to="/login">Login</Link>
    </nav>
  );
}
