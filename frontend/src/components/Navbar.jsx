import { Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import "../styles/Navbar.css";
import icon from "../assets/icon-no-bg.png";
import { getCurrentUser, logout } from "../services/authApi";

export default function Navbar() {
  const [user, setUser] = useState(undefined);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null));
  }, [location.pathname]);

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // session already gone is fine
    }
    setUser(null);
    navigate("/");
  }

  return (
    <nav className="navbar">
      <div className="nav-left">
        <img src={icon} alt="PC Build Generator Icon" className="nav-icon" />
        <span className="nav-title">PC Build Generator</span>
      </div>
      <div className="nav-links">
        <Link to="/" className="nav-link">Home</Link>
        <Link to="/picker" className="nav-link">Get Started</Link>
        <Link to="/saved" className="nav-link">Saved Builds</Link>
      </div>
      {user ? (
        <button className="nav-button" onClick={handleLogout}>Logout</button>
      ) : (
        <Link to="/signup" className="nav-button">Sign Up | Login</Link>
      )}
    </nav>
  );
}
