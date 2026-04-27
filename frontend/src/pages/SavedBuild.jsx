import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getCurrentUser } from "../services/authApi";
import { deleteSavedBuild, fetchSavedBuilds } from "../services/buildApi";
import "../styles/SavedBuild.css";

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
  const [user, setUser] = useState(null);
  const [builds, setBuilds] = useState([]);

  useEffect(() => {
    async function loadDashboard() {
      setStatus("loading");
      setError("");

      try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
          setStatus("signedOut");
          return;
        }

        setUser(currentUser);
        setBuilds(await fetchSavedBuilds());
        setStatus("ready");
      } catch (e) {
        setError(e.message || "Unable to connect to backend");
        setUser(null);
        setBuilds([]);
        setStatus("error");
      }
    }

    loadDashboard();
  }, []);

  const summaryText = useMemo(() => {
    if (builds.length === 0) {
      return "No saved builds yet. Head to the build page and save your first one.";
    }

    return `${builds.length} saved build${builds.length === 1 ? "" : "s"}`;
  }, [builds]);

  const handleDelete = (buildId) => {
    if (!user) return;

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
                canDelete={true}
              />
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}
