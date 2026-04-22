"use client";

import dynamic from "next/dynamic";

const HomePage = dynamic(
  () => import("@/components/HomePage").then((m) => m.HomePage),
  { ssr: false, loading: () => <p className="panel-hint">Loading…</p> },
);

export default function Page() {
  return <HomePage />;
}
