import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getCurrentUser } from "../services/authApi";
import { deleteSavedBuild, fetchSavedBuilds } from "../services/buildApi";
import {
  getSavedBuildsForUser,
  removeSavedBuildForUser,
} from "../services/savedBuilds";
import "../styles/SavedBuild.css";

const EXAMPLE_BUILDS = [
  {
    id: "demo-1",
    title: "Balanced 1080p Starter",
    createdAt: "2026-03-15T14:30:00.000Z",
    totalPrice: 897,
    budget: 1000,
    compatible: true,
    performanceScore: 74,
    parts: {
      cpu: { name: "Ryzen 5 5600X" },
      gpu: { name: "RTX 3060" },
      ram: { name: "16GB DDR4 3200MHz" },
      mobo: { name: "ROG STRIX B550-F" },
      psu: { name: "Focus GX-650" },
    },
  },
  {
    id: "demo-2",
    title: "Creator Midrange Build",
    createdAt: "2026-03-14T19:05:00.000Z",
    totalPrice: 1325,
    budget: 1400,
    compatible: true,
    performanceScore: 86,
    parts: {
      cpu: { name: "Intel i7-12700K" },
      gpu: { name: "RTX 4070" },
      ram: { name: "32GB DDR5 6000MHz" },
      mobo: { name: "MSI PRO Z690-A" },
      psu: { name: "Corsair RM750e" },
    },
  },
  {
    id: "demo-3",
    title: "High FPS Competitive",
    createdAt: "2026-03-13T09:48:00.000Z",
    totalPrice: 1750,
    budget: 1800,
    compatible: true,
    performanceScore: 92,
    parts: {
      cpu: { name: "Ryzen 7 7800X3D" },
      gpu: { name: "RTX 4070 Ti SUPER" },
      ram: { name: "32GB DDR5 6000MHz" },
      mobo: { name: "Gigabyte B650 AORUS Elite" },
      psu: { name: "Seasonic Focus GX-850" },
    },
  },
];

function BuildCard({ build, onDelete, canDelete }) {
  return (
    <article className="saved-card">
      <header className="saved-card__header">
        <div>
          <h3>{build.title || "Saved Build"}</h3>
          <p>{new Date(build.createdAt).toLocaleString()}</p>
        </div>
        {canDelete ? (
          <button type="button" className="saved-card__remove" onClick={() => onDelete(build.id)}>
            Remove
          </button>
        ) : null}
      </header>

      <div className="saved-card__meta">
        <span>Total: ${build.totalPrice ?? 0}</span>
        <span>Budget: ${build.budget ?? 0}</span>
        <span>{build.compatible ? "Compatible" : "Has Issues"}</span>
        <span>Performance: {build.performanceScore ?? 0}%</span>
      </div>

      <ul className="saved-card__parts">
        {Object.entries(build.parts ?? {}).map(([name, part]) => (
          <li key={name}>
            <strong>{name.toUpperCase()}:</strong> {part?.name ?? "N/A"}
          </li>
        ))}
      </ul>
    </article>
  );
}

export default function SavedBuild() {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isLocalFallback, setIsLocalFallback] = useState(false);
  const [user, setUser] = useState(null);
  const [builds, setBuilds] = useState([]);

  useEffect(() => {
    async function loadDashboard() {
      setStatus("loading");
      setError("");
      setIsDemoMode(false);
      setIsLocalFallback(false);

      try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
          setStatus("signedOut");
          return;
        }

        setUser(currentUser);
        try {
          setBuilds(await fetchSavedBuilds());
        } catch (buildError) {
          setBuilds(getSavedBuildsForUser(currentUser));
          setError(buildError.message || "Unable to load synced builds");
          setIsLocalFallback(true);
        }
        setStatus("ready");
      } catch (e) {
        setError(e.message || "Unable to connect to backend");
        setUser(null);
        setBuilds(EXAMPLE_BUILDS);
        setIsDemoMode(true);
        setStatus("ready");
      }
    }

    loadDashboard();
  }, []);

  const summaryText = useMemo(() => {
    if (isDemoMode) {
      return `${builds.length} example build${builds.length === 1 ? "" : "s"}`;
    }

    if (builds.length === 0) {
      return "No saved builds yet. Head to the build page and save your first one.";
    }

    return `${builds.length} saved build${builds.length === 1 ? "" : "s"}`;
  }, [builds, isDemoMode]);

  const handleDelete = (buildId) => {
    if (!user) return;

    if (isLocalFallback) {
      removeSavedBuildForUser(user, buildId);
      setBuilds((current) => current.filter((build) => build.id !== buildId));
      return;
    }

    deleteSavedBuild(buildId)
      .then(() => {
        setBuilds((current) => current.filter((build) => build.id !== buildId));
      })
      .catch((deleteError) => {
        setError(deleteError.message || "Unable to delete build right now");
      });
  };

  return (
    <div className="saved-page">
      <div className="saved-shell">
        <header className="saved-header">
          <h1>Saved Builds</h1>
          {status === "ready" ? <p>{summaryText}</p> : null}
        </header>

        {status === "loading" ? <p className="saved-status">Loading dashboard...</p> : null}

        {status === "signedOut" ? (
          <section className="saved-empty">
            <h2>Sign in to view your dashboard</h2>
            <p>
              Saved builds are tied to your account so you can find them later on any device.
            </p>
            <div className="saved-empty__actions">
              <Link to="/login" className="saved-btn saved-btn--primary">
                Log In
              </Link>
              <Link to="/build" className="saved-btn saved-btn--secondary">
                Start Building
              </Link>
            </div>
          </section>
        ) : null}

        {isDemoMode ? (
          <p className="saved-status saved-status--demo">
            Backend unavailable, showing example dashboard data for demo mode.
          </p>
        ) : null}

        {isLocalFallback ? (
          <p className="saved-status saved-status--fallback">
            Showing local saved builds because backend sync is unavailable right now.
          </p>
        ) : null}

        {status === "error" ? <p className="saved-status saved-status--error">{error}</p> : null}

        {status === "ready" && builds.length === 0 ? (
          <section className="saved-empty">
            <h2>No saved builds yet</h2>
            <p>Create a build and click Save This Build to add it here.</p>
            <Link to="/build" className="saved-btn saved-btn--primary">
              Create a Build
            </Link>
          </section>
        ) : null}

        {status === "ready" && builds.length > 0 ? (
          <section className="saved-grid">
            {builds.map((build) => (
              <BuildCard
                key={build.id}
                build={build}
                onDelete={handleDelete}
                canDelete={!isDemoMode}
              />
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}
