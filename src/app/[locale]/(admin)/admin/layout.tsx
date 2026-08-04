import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
interface AdminLayoutProps {
  children?: React.ReactNode;
  params: Promise<{
    locale: string;
  }>;
}

export default async function AdminLayout({
  children,
  params,
}: AdminLayoutProps) {
  const { locale } = await params;

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader locale={locale} />

      <div className="flex h-[calc(100vh-64px)]">
        {/* Admin Sidebar */}
        <AdminSidebar locale={locale} />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
