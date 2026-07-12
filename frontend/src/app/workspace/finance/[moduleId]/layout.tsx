export function generateStaticParams() {
  return [{ moduleId: "__init__" }];
}

export default function FinanceModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
