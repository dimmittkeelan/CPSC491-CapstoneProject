import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { BuildProvider } from "./context/BuildContext";
import Home from "./pages/Home";
import Build from "./pages/Build";
import SavedBuild from "./pages/SavedBuild";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import PartPicker from "./pages/PartPicker";
import Navbar from "./components/Navbar";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Navbar />
        <main className="main">
        <BuildProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/picker" element={<PartPicker />} />
            <Route path="/build" element={<Build />} />
            <Route path="/saved" element={<SavedBuild />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BuildProvider>
        </main>
      </div>
    </BrowserRouter>
  );
}
