import TabBar from "@/components/TabBar";

export default function TabsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <main className="mx-auto max-w-5xl p-4">{children}</main>
      <TabBar />
    </div>
  );
}
