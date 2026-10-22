import DashboardLayout from "@/app/dashboard/layout";

/** The admin pages sit in the app shell (the bar shows Admin to admins only). */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
