// Remounts on every route change — gives each page its 200ms entrance.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
