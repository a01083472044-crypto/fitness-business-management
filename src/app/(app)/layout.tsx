import ClientWrapper from "../components/ClientWrapper";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <ClientWrapper>{children}</ClientWrapper>;
}
