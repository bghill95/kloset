export default function PageHeader({ title }: { title: string }) {
  // The menu button is rendered by the tabs layout (persistent across
  // navigations) absolutely over this slot — pad the title clear of it:
  // 40px button + 12px gap.
  return (
    <header className="flex items-center pb-2 pl-[52px]">
      <h1 className="font-display text-4xl text-ink">{title}</h1>
    </header>
  );
}
