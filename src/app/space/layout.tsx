import { PrivateNav } from "@/components/private-nav";
import { PresenceHeartbeat } from "@/components/presence-heartbeat";
export const dynamic = "force-dynamic";
export default function PrivateLayout({children}: {children: React.ReactNode}) {
  return <div className="private-shell">
    <PresenceHeartbeat />
    <a className="skip-link" href="#private-content">Skip to content</a>
    <PrivateNav />
    <main id="private-content" className="private-content">{children}</main>
  </div>;
}
