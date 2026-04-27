import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { BuildProvider } from "./context/BuildContext";
import Home from "./pages/Home";
import Build from "./pages/Build";
import SavedBuild from "./pages/SavedBuild";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Account from "./pages/Account";
import PartPicker from "./pages/PartPicker";
import Navbar from "./components/Navbar";
import UxErrorBoundary from "./components/UxErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import "./App.css";

export default function App() {
  const reportIssueHref =
    "mailto:pcpartgeneratorsupport@gmail.com?subject=PC%20Build%20Generator%20Issue&body=Please%20describe%20what%20happened%2C%20what%20you%20expected%2C%20and%20how%20to%20reproduce%20it.";

  return (
    <BrowserRouter>
      <UxErrorBoundary>
        <div className="app">
          <Navbar />
          <main className="main">
            <BuildProvider>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/picker" element={<PartPicker />} />
                <Route path="/build" element={<Build />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<SignUp />} />
                <Route element={<ProtectedRoute />}>
                  <Route path="/saved" element={<SavedBuild />} />
                  <Route path="/account" element={<Account />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BuildProvider>
          </main>

          <footer className="app-report-footer" aria-label="Report an issue">
            <a className="app-report-footer__button" href={reportIssueHref}>
              Report an Issue
            </a>
          </footer>
        </div>
      </UxErrorBoundary>
    </BrowserRouter>
  );
}
