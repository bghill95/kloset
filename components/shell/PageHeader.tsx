import Menu from "./Menu";

export default function PageHeader({ title }: { title: string }) {
  return (
    <header className="flex items-center gap-3 pb-2">
      <Menu />
      <h1 className="font-display text-4xl text-ink">{title}</h1>
    </header>
  );
}
