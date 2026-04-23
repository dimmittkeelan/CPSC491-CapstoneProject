import "../styles/LoadingSpinner.css";

export function LoadingSpinner({ message = "Loading..." }) {
  return (
    <div className="spinner-container" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
