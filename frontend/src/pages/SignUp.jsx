import React, { useState } from "react";
import "../styles/SignUp.css";
import { Link } from "react-router-dom";

export default function SignUp() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: Replace this console.log with a POST request to the server
    // Example using fetch:
    // fetch("http://localhost:5000/signup", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ username, password, email }),
    // })
    //   .then((response) => response.json())
    //   .then((data) => console.log(data))
    //   .catch((error) => console.error("Error:", error));
    console.log("Username:", username);
    console.log("Password:", password);
    console.log("Email:", email);
  };

  return (
    <div className="signup-container">
      <form className="signup-form" onSubmit={handleSubmit}>
        <h2>Sign Up</h2>
        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
        />
        <label htmlFor="username">Username</label>
        <input
          type="text"
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter your username"
        />
        <label htmlFor="password">Password</label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          required                // 1. Required field
          minLength="8"           // 2. Must be at least 8 characters
          pattern="(?=.*\d).*"    // 3. Must contain at least one number
          title="Password must be at least 8 characters and contain a number" // 4. The error message
        />
        <button type="submit">Sign Up</button>
        <p className="login-redirect">
          Already have an account? <Link to="/login">Click here to login</Link>
        </p>
      </form>
    </div>
  );
}
