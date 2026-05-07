"use client";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  TrendingUp, LayoutDashboard, Users, BarChart2,
  Settings, LogOut, ArrowLeftRight, ExternalLink,
} from "lucide-react";

const NAV = [
  { href: "/ao/admin/dashboard",    label: "Dashboard",    Icon: LayoutDashboard, badge: false },
  { href: "/ao/admin/users",        label: "Utilizadores", Icon: Users,            badge: false },
  { href: "/ao/admin/transactions", label: "Transações",   Icon: ArrowLeftRight,   badge: true  },
  { href: "/ao/admin/trades",       label: "Operações",    Icon: BarChart2,        badge: false },
  { href: "/ao/admin/settings",     label: "Configurações",Icon: Settings,         badge: false },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { data: session, status } = useSession();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && (session?.user as any)?.role !== "admin") router.push("/trade");
  }, [status, session, router]);

  // Poll pending transactions count
  useEffect(() => {
    if (status !== "authenticated") return;

    async function fetchPending() {
      try {
        const res = await fetch("/api/admin/transactions?status=pending");
        if (res.ok) {
          const data = await res.json();
          setPendingCount(Array.isArray(data) ? data.length : 0);
        }
      } catch { /* silent */ }
    }

    fetchPending();
    const id = setInterval(fetchPending, 30_000);
    return () => clearInterval(id);
  }, [status]);

  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#f5a623", fontFamily: "system-ui, sans-serif", fontSize: 16 }}>A verificar permissões...</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#0a0f1e", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* Sidebar */}
      <aside style={{
        width: 240, flexShrink: 0, background: "#111827",
        borderRight: "1px solid #1e2d50",
        display: "flex", flexDirection: "column",
        position: "sticky", top: 0, height: "100vh",
      }}>

        {/* Logo */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #1e2d50" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, background: "#ef4444", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <TrendingUp size={18} color="#fff" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>Dynamics Works</div>
              <div style={{ color: "#ef4444", fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>ADMIN PANEL</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
          {NAV.map(({ href, label, Icon, badge }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            const showBadge = badge && pendingCount > 0;
            return (
              <a key={href} href={href}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 8, marginBottom: 2,
                  background:  active ? "rgba(245,166,35,0.12)" : "transparent",
                  color:       active ? "#f5a623" : "#94a3b8",
                  borderLeft:  active ? "3px solid #f5a623" : "3px solid transparent",
                  textDecoration: "none", fontSize: 14, fontWeight: active ? 700 : 500,
                  transition: "background 0.15s, color 0.15s",
                  boxSizing: "border-box",
                }}>
                <Icon size={17} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{label}</span>
                {showBadge && (
                  <span style={{
                    background: "#ef4444", color: "#fff",
                    borderRadius: 20, fontSize: 11, fontWeight: 700,
                    padding: "1px 7px", lineHeight: "16px",
                  }}>
                    {pendingCount}
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: "12px 10px", borderTop: "1px solid #1e2d50" }}>
          {/* Admin info */}
          <div style={{ padding: "8px 12px", marginBottom: 8 }}>
            <div style={{ color: "#fff", fontSize: 13, fontWeight: 600, marginBottom: 1 }}>
              {session?.user?.name ?? "—"}
            </div>
            <div style={{ color: "#64748b", fontSize: 11 }}>{session?.user?.email}</div>
          </div>

          {/* Ver plataforma */}
          <a href="/trade" target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", marginBottom: 6, background: "rgba(245,166,35,0.07)", border: "1px solid rgba(245,166,35,0.15)", borderRadius: 8, color: "#f5a623", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
            <ExternalLink size={14} /> Ver plataforma
          </a>

          {/* Sair */}
          <button onClick={() => signOut({ callbackUrl: "/login" })}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "#ef4444", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            <LogOut size={15} /> Sair
          </button>
        </div>
      </aside>

      {/* Content */}
      <main style={{ flex: 1, overflowY: "auto", minHeight: "100vh" }}>
        {children}
      </main>
    </div>
  );
}
