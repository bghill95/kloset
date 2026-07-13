import Menu from "./Menu";

export default function PageHeader({ title }: { title: string }) {
  return (
    <header className="flex items-center justify-between pb-2">
      <h1 className="font-display text-4xl text-ink">{title}</h1>
      <Menu />
    </header>
  );
}
