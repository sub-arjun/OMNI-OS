import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from 'stores/useAuthStore';

/**
 * A component that protects routes by requiring authentication.
 * Redirects to the login page if the user is not authenticated.
 */
export default function ProtectedRoute() {
  const { user, session } = useAuthStore();

  // If the user is not authenticated, redirect to the login page
  if (!user || !session) {
    return <Navigate to="/user/login" replace />;
  }

  // If the user is authenticated, render the child routes
  return <Outlet />;
} 