import TabBar from "@/components/TabBar";

export default function TabsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh pb-20">
      <main className="mx-auto max-w-5xl p-4">{children}</main>
      <TabBar />
    </div>
  );
}
