"use client";

interface SkeletonProps {
  width?:  string | number;
  height?: string | number;
  radius?: string | number;
  style?:  React.CSSProperties;
}

export function Skeleton({ width = "100%", height = 16, radius = 8, style }: SkeletonProps) {
  return (
    <>
      <style>{`
        @keyframes sk-shimmer {
          0%   { background-position: -400px 0 }
          100% { background-position:  400px 0 }
        }
        .sk-shimmer {
          background: linear-gradient(90deg, #111827 25%, #1a2540 50%, #111827 75%);
          background-size: 800px 100%;
          animation: sk-shimmer 1.4s ease-in-out infinite;
        }
      `}</style>
      <div
        className="sk-shimmer"
        style={{ width, height, borderRadius: radius, flexShrink: 0, ...style }}
      />
    </>
  );
}

export function SkeletonCard({ rows = 3, style }: { rows?: number; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: "20px 22px", ...style }}>
      <Skeleton height={14} width="55%" radius={6} style={{ marginBottom: 14 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={10} width={i === rows - 1 ? "70%" : "100%"} radius={5} style={{ marginBottom: i < rows - 1 ? 8 : 0 }} />
      ))}
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: "18px 20px" }}>
      <Skeleton height={11} width="50%" radius={5} style={{ marginBottom: 12 }} />
      <Skeleton height={28} width="65%" radius={7} style={{ marginBottom: 8 }} />
      <Skeleton height={10} width="40%" radius={5} />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ background: "#111827", padding: "14px 18px", display: "flex", gap: 12, alignItems: "center", borderRadius: i === 0 ? "10px 10px 0 0" : i === rows - 1 ? "0 0 10px 10px" : 0, border: "1px solid #1e2d50", borderTop: i > 0 ? "none" : "1px solid #1e2d50" }}>
          <Skeleton height={32} width={32} radius="50%" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <Skeleton height={11} width="40%" radius={5} />
            <Skeleton height={9}  width="25%" radius={4} />
          </div>
          <Skeleton height={11} width={60} radius={5} />
        </div>
      ))}
    </div>
  );
}
