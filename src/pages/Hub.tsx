import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Factory, BarChart3, DollarSign, LogOut, Settings } from "lucide-react";

interface PortalCard {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  route: string | null;
  available: boolean;
}

const portals: PortalCard[] = [
  {
    id: "production",
    name: "Production",
    description: "Manage daily output, lines, work orders, and dispatch",
    icon: <Factory className="h-7 w-7" />,
    color: "#3b82f6",
    route: "/dashboard",
    available: true,
  },
  {
    id: "finance",
    name: "Finance",
    description: "Track costs, invoices, and financial reporting",
    icon: <DollarSign className="h-7 w-7" />,
    color: "#10b981",
    route: null,
    available: false,
  },
  {
    id: "analytics",
    name: "Analytics",
    description: "Insights and data analysis across production",
    icon: <BarChart3 className="h-7 w-7" />,
    color: "#8b5cf6",
    route: null,
    available: false,
  },
];

export default function Hub() {
  const { profile, factory, signOut } = useAuth();
  const navigate = useNavigate();

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  })();

  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#0a0a0a",
        color: "#ffffff",
        overflowY: "auto",
        zIndex: 50,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Top bar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 40px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              height: 32,
              width: 32,
              borderRadius: 8,
              backgroundColor: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>W</span>
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>
            WovenTex
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <button
            onClick={() => navigate("/preferences")}
            title="Settings"
            style={{
              background: "none",
              border: "none",
              padding: 8,
              borderRadius: 8,
              cursor: "pointer",
              color: "rgba(255,255,255,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.9)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
          >
            <Settings size={20} />
          </button>
          <button
            onClick={async () => {
              await signOut();
              navigate("/auth");
            }}
            title="Sign out"
            style={{
              background: "none",
              border: "none",
              padding: 8,
              borderRadius: 8,
              cursor: "pointer",
              color: "rgba(255,255,255,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.9)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main style={{ padding: "32px 40px 60px", maxWidth: 960 }}>
        {/* Greeting */}
        <h1
          style={{
            fontSize: 34,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            margin: "0 0 4px",
            color: "#ffffff",
          }}
        >
          {greeting}, {firstName}
        </h1>
        {factory && (
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", margin: "0 0 48px" }}>
            {factory.name}
          </p>
        )}

        {/* Portal label */}
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 20px", color: "#ffffff" }}>
          Portals
        </h2>

        {/* Portal grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {portals.map((portal) => (
            <button
              key={portal.id}
              onClick={() => {
                if (portal.available && portal.route) {
                  navigate(portal.route);
                }
              }}
              style={{
                position: "relative",
                textAlign: "left",
                borderRadius: 12,
                padding: 24,
                border: "1px solid rgba(255,255,255,0.08)",
                backgroundColor: "rgba(255,255,255,0.04)",
                cursor: portal.available ? "pointer" : "default",
                opacity: portal.available ? 1 : 0.45,
                transition: "background-color 0.2s, border-color 0.2s",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                if (portal.available) {
                  e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              }}
            >
              {/* Icon */}
              <div
                style={{
                  height: 48,
                  width: 48,
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                  backgroundColor: `${portal.color}20`,
                  color: portal.color,
                }}
              >
                {portal.icon}
              </div>

              {/* Name */}
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#ffffff",
                  margin: "0 0 4px",
                }}
              >
                {portal.name}
              </h3>

              {/* Description */}
              <p
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.4)",
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {portal.description}
              </p>

              {/* Coming soon badge */}
              {!portal.available && (
                <span
                  style={{
                    position: "absolute",
                    top: 16,
                    right: 16,
                    fontSize: 11,
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.3)",
                    backgroundColor: "rgba(255,255,255,0.06)",
                    padding: "2px 8px",
                    borderRadius: 99,
                  }}
                >
                  Coming soon
                </span>
              )}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
