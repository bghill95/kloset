import Menu from "@/components/shell/Menu";
import PageTransition from "@/components/shell/PageTransition";

export default function TabsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <main className="relative mx-auto max-w-5xl p-4">
        {/* The menu lives in the layout, not the page header, so it survives
            page swaps — its sheet can slide down over the incoming page
            (the dismissal IS the section-switch transition). */}
        <div className="absolute left-4 top-4 z-10">
          <Menu />
        </div>
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
