export function generateStaticParams() {
  return [{ projectId: "__init__" }];
}

export default function CodingProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
