import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getCurrentUser } from "../services/authApi";
import { LoadingSpinner } from "./LoadingSpinner";

export default function ProtectedRoute({ redirectTo = "/login", children }) {
  const location = useLocation();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    getCurrentUser()
      .then((user) => {
        if (!isMounted) return;
        setIsAuthenticated(Boolean(user));
      })
      .catch(() => {
        if (!isMounted) return;
        setIsAuthenticated(false);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsCheckingAuth(false);
      });

    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  if (isCheckingAuth) {
    return <LoadingSpinner message="Checking authentication..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  return children ?? <Outlet />;
}