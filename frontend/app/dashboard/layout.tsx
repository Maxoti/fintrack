import type { Metadata } from "next";
import "./dashboard.css";
import Shell from "./components-dashboard/Shell";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Portfolios | FinTrack by Finnet Technologies" };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
 <Shell>{children}</Shell>
    </Suspense>
 
  );
}
