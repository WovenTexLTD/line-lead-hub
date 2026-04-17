import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Factory,
  BarChart3,
  DollarSign,
  LogOut,
  HelpCircle,
  Settings,
} from "lucide-react";
import { motion } from "framer-motion";

interface Portal {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  gradient: string;
  route: string | null;
  available: boolean;
}

const portals: Portal[] = [
  {
    id: "production",
    name: "Production",
    description: "Manage daily output, lines, work orders, and dispatch",
    icon: <Factory size={22} />,
    color: "#3b82f6",
    gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    route: "/dashboard",
    available: true,
  },
  {
    id: "finance",
    name: "Finance",
    description: "Track costs, invoices, and financial reporting",
    icon: <DollarSign size={22} />,
    color: "#10b981",
    gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    route: null,
    available: false,
  },
  {
    id: "analytics",
    name: "Analytics",
    description: "Insights and data analysis across production",
    icon: <BarChart3 size={22} />,
    color: "#8b5cf6",
    gradient: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
    route: "/analytics",
    available: true,
  },
];

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.12 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } },
};

export default function Hub() {
  const { profile, factory, signOut } = useAuth();
  const navigate = useNavigate();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const firstName = profile?.full_name?.split(" ")[0] ?? "";
  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* ─── Left sidebar ─── */}
      <aside
        style={{
          width: 260,
          minWidth: 260,
          background: "#0a0a0f",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 0,
        }}
      >
        {/* Top: Logo */}
        <div style={{ padding: "20px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px" }}>
            <div
              style={{
                height: 30,
                width: 30,
                borderRadius: 7,
                background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>W</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
              WovenTex
            </span>
          </div>

          {/* Sidebar nav items */}
          <nav style={{ marginTop: 28 }}>
            <SidebarLink icon={<Factory size={18} />} label="Portals" active />
            <SidebarLink
              icon={<Settings size={18} />}
              label="Settings"
              onClick={() => navigate("/preferences")}
            />
            <SidebarLink
              icon={<HelpCircle size={18} />}
              label="Help"
              onClick={() => window.open("https://productionportal.co", "_blank")}
            />
          </nav>
        </div>

        {/* Bottom: User profile */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Avatar */}
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid rgba(59,130,246,0.25)",
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "rgba(59,130,246,0.15)",
                  color: "#60a5fa",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 600,
                  flexShrink: 0,
                  border: "2px solid rgba(59,130,246,0.25)",
                }}
              >
                {initials}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.85)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {profile?.full_name}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.35)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {factory?.name ?? "Admin"}
              </div>
            </div>
            <button
              onClick={async () => {
                await signOut();
                navigate("/auth");
              }}
              title="Sign out"
              style={{
                background: "none",
                border: "none",
                padding: 6,
                borderRadius: 6,
                cursor: "pointer",
                color: "rgba(255,255,255,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "color 0.15s",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main content area ─── */}
      <div
        style={{
          flex: 1,
          background: "#141418",
          overflowY: "auto",
          color: "#fff",
        }}
      >
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          style={{ padding: "48px 48px 80px", maxWidth: 960 }}
        >
          {/* Greeting */}
          <motion.div variants={fadeUp}>
            <h1
              style={{
                fontSize: 30,
                fontWeight: 600,
                letterSpacing: "-0.025em",
                margin: 0,
                color: "#fff",
              }}
            >
              {greeting}, {firstName}
            </h1>
            {factory && (
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", margin: "6px 0 0" }}>
                {factory.name}
              </p>
            )}
          </motion.div>

          {/* Portals heading */}
          <motion.h2
            variants={fadeUp}
            style={{
              fontSize: 15,
              fontWeight: 600,
              margin: "44px 0 14px",
              color: "rgba(255,255,255,0.7)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Portals
          </motion.h2>

          {/* Portal tiles */}
          <motion.div
            variants={stagger}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 10,
            }}
          >
            {portals.map((p) => (
              <motion.button
                key={p.id}
                variants={fadeUp}
                whileHover={p.available ? { y: -3 } : undefined}
                whileTap={p.available ? { scale: 0.98 } : undefined}
                onClick={() => p.available && p.route && navigate(p.route)}
                style={{
                  position: "relative",
                  textAlign: "left",
                  borderRadius: 10,
                  padding: "18px 20px",
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(255,255,255,0.03)",
                  cursor: p.available ? "pointer" : "default",
                  opacity: p.available ? 1 : 0.4,
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  transition: "background 0.2s, border-color 0.2s, box-shadow 0.25s",
                }}
                onMouseEnter={(e) => {
                  if (p.available) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.055)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                    e.currentTarget.style.boxShadow = `0 4px 20px rgba(0,0,0,0.25)`;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    height: 40,
                    width: 40,
                    minWidth: 40,
                    borderRadius: 9,
                    background: p.gradient,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                  }}
                >
                  {p.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 2 }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.4 }}>
                    {p.description}
                  </div>
                </div>

                {!p.available && (
                  <span
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 12,
                      fontSize: 10,
                      fontWeight: 500,
                      color: "rgba(255,255,255,0.25)",
                      background: "rgba(255,255,255,0.04)",
                      padding: "2px 7px",
                      borderRadius: 99,
                    }}
                  >
                    Coming soon
                  </span>
                )}
              </motion.button>
            ))}
          </motion.div>

          {/* Welcome banner */}
          <motion.div
            variants={fadeUp}
            style={{
              marginTop: 28,
              borderRadius: 14,
              padding: "28px 32px",
              background: "linear-gradient(135deg, #151a2e 0%, #0f1322 50%, #141830 100%)",
              border: "1px solid rgba(255,255,255,0.05)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -50,
                right: -50,
                width: 180,
                height: 180,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)",
                pointerEvents: "none",
              }}
            />
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 6px", color: "#fff", position: "relative" }}>
              Welcome to WovenTex
            </h3>
            <p
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.4)",
                margin: 0,
                lineHeight: 1.6,
                maxWidth: 480,
                position: "relative",
              }}
            >
              Your unified platform for garment factory management. Access production
              tracking, financial tools, and analytics — all in one place.
            </p>
            <div style={{ display: "flex", gap: 6, marginTop: 18, position: "relative" }}>
              {portals.map((p) => (
                <div
                  key={p.id}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 7,
                    background: p.gradient,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: p.available ? 1 : 0.35,
                    color: "#fff",
                  }}
                >
                  {p.id === "production" && <Factory size={14} />}
                  {p.id === "finance" && <DollarSign size={14} />}
                  {p.id === "analytics" && <BarChart3 size={14} />}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

/* ─── Sidebar link ─── */
function SidebarLink({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "9px 12px",
        borderRadius: 8,
        border: "none",
        background: active ? "rgba(255,255,255,0.06)" : "transparent",
        color: active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)",
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        fontFamily: "inherit",
        cursor: onClick ? "pointer" : "default",
        transition: "background 0.15s, color 0.15s",
        marginBottom: 2,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
          e.currentTarget.style.color = "rgba(255,255,255,0.7)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "rgba(255,255,255,0.45)";
        }
      }}
    >
      {icon}
      {label}
    </button>
  );
}
