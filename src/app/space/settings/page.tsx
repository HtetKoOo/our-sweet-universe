import { requireCouple } from "@/lib/authorization";
import { BirthdayForm, CoupleForm } from "@/components/memory-form";
import { SignOut } from "@/components/sign-out";
import { PartnerInvite } from "@/components/partner-invite";
import { StartFresh } from "@/components/start-fresh";
import { getDb } from "@/lib/db";
import { coupleMembers, user } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
export default async function Settings() {
  const couple = await requireCouple();
  const [partner] = await getDb().select({ name: user.name, email: user.email }).from(coupleMembers).innerJoin(user, eq(coupleMembers.userId, user.id)).where(and(eq(coupleMembers.coupleId, couple.coupleId), eq(coupleMembers.role, "partner"))).limit(1);
  const [me] = await getDb().select({ birthday: user.birthday }).from(user).where(eq(user.id, couple.userId)).limit(1);
  return <><p className="eyebrow">THE DETAILS THAT MAKE US, US</p><h1>Our details.</h1>
    {couple.role === "owner" ? <CoupleForm couple={{name:couple.name,togetherSince:couple.togetherSince,timezone:couple.timezone}} /> : <p>Only the owner can change our space settings.</p>}
    <section className="private-account"><h2>Your birthday</h2><BirthdayForm birthday={me?.birthday ?? null} /></section>
    {couple.role === "owner" ? <PartnerInvite partner={partner ?? null} /> : null}
    {couple.role === "owner" ? <StartFresh /> : null}
    <section className="private-account"><h2>Your account</h2><SignOut /></section>
  </>;
}
