export default function TabsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
