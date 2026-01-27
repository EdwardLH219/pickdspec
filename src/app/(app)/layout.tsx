import { BranchProvider } from "@/hooks/use-branch";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Toaster } from "@/components/ui/sonner";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BranchProvider>
      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:border-r lg:bg-background">
          <Sidebar />
        </aside>

        {/* Main content area */}
        <div className="flex flex-1 flex-col lg:pl-64">
          <Header />
          <main className="flex-1 p-4 lg:p-6">{children}</main>
        </div>
      </div>
      <Toaster position="bottom-right" richColors />
    </BranchProvider>
  );
}
