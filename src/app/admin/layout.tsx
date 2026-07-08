import { AdminNav } from "@/components/admin/AdminNav";

// Route protection happens in src/middleware.ts (session check + redirect
// to /admin/login). This layout only provides the console chrome; the login
// page renders its own full-screen layout inside it.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-100">
      <AdminNav />
      <main>{children}</main>
    </div>
  );
}
