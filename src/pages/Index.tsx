import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export default function Index() {
  const { user, loading, profile, roles, hasRole, isAdminOrHigher } = useAuth();

  // Show loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect authenticated users based on role
  if (user) {
    if (!profile) return <Navigate to="/auth" replace />;

    if (!profile.factory_id) {
      return <Navigate to="/setup/factory" replace />;
    }

    // Check for cutting role first
    if (hasRole('cutting')) {
      return <Navigate to="/cutting/submissions" replace />;
    }

    // Check for storage role
    if (hasRole('storage')) {
      return <Navigate to="/storage" replace />;
    }

    // Admins and owners always go to dashboard
    if (isAdminOrHigher()) {
      return <Navigate to="/dashboard" replace />;
    }

    // Check for finishing department workers
    if (profile.department === 'finishing') {
      return <Navigate to="/finishing/daily-target" replace />;
    }

    // Remaining workers go to sewing targets
    return <Navigate to="/sewing/morning-targets" replace />;
  }

  // Redirect unauthenticated users to auth page
  return <Navigate to="/auth" replace />;
}
