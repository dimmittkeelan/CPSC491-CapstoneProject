import { Component } from "react";

class UxErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled UI error captured by UxErrorBoundary", error, info);
  }

  handleTryAgain = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    window.location.assign("/");
  };

  render() {
    const { hasError, error } = this.state;

    if (hasError) {
      return (
        <section className="ux-error-boundary" role="alert" aria-live="assertive">
          <div className="ux-error-boundary__card">
            <h1>Something went wrong</h1>
            <p>
              We hit an unexpected issue while loading this view. You can retry this action or return to
              the home page.
            </p>

            <div className="ux-error-boundary__actions">
              <button type="button" onClick={this.handleTryAgain}>
                Try Again
              </button>
              <button type="button" onClick={this.handleGoHome} className="secondary">
                Go Home
              </button>
            </div>

            {import.meta.env.DEV && error?.message ? (
              <pre className="ux-error-boundary__details">{error.message}</pre>
            ) : null}
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}

export default UxErrorBoundary;