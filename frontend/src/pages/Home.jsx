import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div style={{ padding: 24 }}>
      <h1>PC Build Generator</h1>
      <p>Enter a budget, generate a compatible build, and save it.</p>
      <Link to="/build">Start Building →</Link>
    </div>
  );
}
