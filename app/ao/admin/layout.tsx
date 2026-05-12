"use client";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  TrendingUp, LayoutDashboard, Users, BarChart2,
  Settings, LogOut, ArrowLeftRight, ExternalLink, ScanFace,
  Trophy, MessageCircle, TrendingDown, Bell, ShieldCheck, Gift, LineChart,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  Icon: React.ElementType;
  badgeKey?: "txn" | "kyc" | "support";
};

const NAV: NavItem[] = [
  { href: "/ao/admin/dashboard",      label: "Dashboard",      Icon: LayoutDashboard },
  { href: "/ao/admin/reports",        label: "Relatórios",     Icon: LineChart },
  { href: "/ao/admin/users",          label: "Utilizadores",   Icon: Users },
  { href: "/ao/admin/kyc",            label: "KYC",            Icon: ScanFace,       badgeKey: "kyc" },
  { href: "/ao/admin/transactions",   label: "Transações",     Icon: ArrowLeftRight, badgeKey: "txn" },
  { href: "/ao/admin/trades",         label: "Operações",      Icon: BarChart2 },
  { href: "/ao/admin/tournaments",    label: "Torneios",       Icon: Trophy },
  { href: "/ao/admin/notifications",  label: "Notificações",   Icon: Bell },
  { href: "/ao/admin/bonuses",        label: "Bónus",          Icon: Gift },
  { href: "/ao/admin/audit",          label: "Auditoria",      Icon: ShieldCheck },
  { href: "/ao/admin/support",        label: "Suporte",        Icon: MessageCircle, badgeKey: "support" },
  { href: "/ao/admin/settings",       label: "Configurações",  Icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { data: session, status } = useSession();
  const [txnCount,     setTxnCount]     = useState(0);
  const [kycCount,     setKycCount]     = useState(0);
  const [supportCount, setSupportCount] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && (session?.user as { role?: string })?.role !== "admin") router.push("/trade");
  }, [status, session, router]);

  useEffect(() => {
    if (status !== "authenticated") return;

    async function fetchCounts() {
      try {
        const [txnRes, kycRes] = await Promise.all([
          fetch("/api/admin/transactions?status=pending"),
          fetch("/api/admin/kyc"),
        ]);
        if (txnRes.ok) {
          const d = await txnRes.json();
          setTxnCount(typeof d?.total === "number" ? d.total : 0);
        }
        if (kycRes.ok) {
          const d: { user: { kycStatus: string } }[] = await kycRes.json();
          setKycCount(d.filter(e => e.user.kycStatus === "pending").length);
        }
        const supRes = await fetch("/api/admin/support?status=open");
        if (supRes.ok) {
          const d = await supRes.json();
          setSupportCount(Array.isArray(d) ? d.length : 0);
        }
      } catch { /* silent */ }
    }

    fetchCounts();
    const id = setInterval(fetchCounts, 30_000);
    return () => clearInterval(id);
  }, [status]);

  const badges: Record<string, number> = { txn: txnCount, kyc: kycCount, support: supportCount };

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
      <aside style={{ width: 240, flexShrink: 0, background: "#111827", borderRight: "1px solid #1e2d50", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>

        {/* Logo */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #1e2d50" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, background: "#f5a623", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <TrendingUp size={18} color="#000" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>Dynamics Works</div>
              <div style={{ color: "#f5a623", fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>ADMIN PANEL</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
          {NAV.map(({ href, label, Icon, badgeKey }) => {
            const active  = pathname === href || pathname.startsWith(href + "/");
            const count   = badgeKey ? (badges[badgeKey] ?? 0) : 0;
            const isKyc   = badgeKey === "kyc";
            const badgeColor = isKyc ? "#f5a623" : "#ef4444";
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
                {count > 0 && (
                  <span style={{ background: badgeColor, color: isKyc ? "#000" : "#fff", borderRadius: 20, fontSize: 11, fontWeight: 800, padding: "1px 7px", lineHeight: "16px" }}>
                    {count}
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: "12px 10px", borderTop: "1px solid #1e2d50" }}>
          <div style={{ padding: "8px 12px", marginBottom: 8 }}>
            <div style={{ color: "#fff", fontSize: 13, fontWeight: 600, marginBottom: 1 }}>{session?.user?.name ?? "—"}</div>
            <div style={{ color: "#64748b", fontSize: 11 }}>{session?.user?.email}</div>
          </div>
          <a href="/trade" target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", marginBottom: 6, background: "rgba(245,166,35,0.07)", border: "1px solid rgba(245,166,35,0.15)", borderRadius: 8, color: "#f5a623", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
            <ExternalLink size={14} /> Ver plataforma
          </a>
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
