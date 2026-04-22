import type { Metadata } from "next";
import dynamic from "next/dynamic";

const HomePage = dynamic(
  () => import("@/components/HomePage").then((m) => m.HomePage),
  { ssr: false, loading: () => <p className="panel-hint">Loading…</p> },
);

export const metadata: Metadata = {
  other: {
    "talentapp:project_verification":
      "a8d12488b07ae923797ecd1ff94c8f9d8d343c46c1752b2ba27df34cf964c70d61c8c89ddf8290a9e4ef4a86a9c0fbfa3cc2578bc653dff155e070529f1d8e05",
  },
};

export default function Page() {
  return <HomePage />;
}
