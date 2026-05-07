import type { Config } from "@netlify/functions";

export default async () => {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  await fetch(base + "/api/worker");
  await fetch(base + "/api/price-recorder");
};

export const config: Config = { schedule: "* * * * *" };
