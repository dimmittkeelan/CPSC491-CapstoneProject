import { Link } from "react-router-dom";
import "../styles/Navbar.css";
import icon from "../assets/icon-no-bg.png";

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="nav-left">
        <img src={icon} alt="PC Build Generator Icon" className="nav-icon" />
        <span className="nav-title">PC Build Generator</span>
      </div>
      <div className="nav-links">
        <Link to="/" className="nav-link">Home</Link>
        <Link to="/build" className="nav-link">Get Started</Link>
        <Link to="/saved" className="nav-link">Saved Builds</Link>
      </div>
      <Link to="/signup" className="nav-button">Join Now</Link>
    </nav>
  );
}
