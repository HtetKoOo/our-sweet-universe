"use server";
import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCouple } from "@/lib/authorization";
import { getDb } from "@/lib/db";
import { couples, coupleMembers, mediaAssets, memories, user } from "@/lib/db/schema";
import { memoryScope } from "@/lib/db/memory-scope";
import { memoryAssetIdsInput, memoryInput, coupleInput, birthdayInput, type ActionState } from "@/lib/memory-input";

export async function saveMemory(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await requireCouple();
  const id = z.uuid().safeParse(form.get("id"));
  const mode = form.get("mode");
  if (!id.success || (mode !== "create" && mode !== "edit")) return {message: "This form is invalid. Please reopen it."};
  const parsed = memoryInput.safeParse({title: form.get("title"), body: form.get("body"), happenedOn: form.get("happenedOn"), location: form.get("location"), isMilestone: form.get("isMilestone") === "on"});
  if (!parsed.success) return {message: "Please check the highlighted fields.", errors: z.flattenError(parsed.error).fieldErrors};
  const assetIds = memoryAssetIdsInput.safeParse([...new Set(form.getAll("assetId").filter((value): value is string => typeof value === "string"))]);
  if (!assetIds.success) return {message: "Please choose your photos again."};
  const db = getDb();
  try {
    const selectedAssets = assetIds.data.length
      ? await db.select({ id: mediaAssets.id }).from(mediaAssets).where(and(eq(mediaAssets.coupleId, actor.coupleId), inArray(mediaAssets.id, assetIds.data)))
      : [];
    if (selectedAssets.length !== assetIds.data.length) return {message: "One of those photos is no longer available. Please choose it again."};

    // Neon’s HTTP driver has no interactive transaction API. A single data-
    // modifying CTE is still atomic in PostgreSQL: either the memory and all
    // its selected attachments save together, or neither does.
    const createAttachments = assetIds.data.length
      ? sql` , attached as (
          insert into memory_media (couple_id,memory_id,asset_id,attached_by,alt,position)
          select ${actor.coupleId}::uuid,saved.id,chosen.asset_id,${actor.userId},${parsed.data.title},chosen.position
          from saved cross join (values ${sql.join(assetIds.data.map((assetId, position) => sql`(${assetId}::uuid,${position}::integer)`), sql`, `)}) as chosen(asset_id,position)
        )`
      : sql``;
    // Editing syncs attachment links by keeping selected links in place,
    // removing deselected ones, and adding only previously absent links.
    // This avoids deleting and re-inserting the same unique pair in one query.
    const editAttachments = assetIds.data.length
      ? sql`, chosen(asset_id, position) as (
          values ${sql.join(assetIds.data.map((assetId, position) => sql`(${assetId}::uuid,${position}::integer)`), sql`, `)}
        ), updated_links as (
          update memory_media
          set alt=${parsed.data.title}, position=chosen.position
          from saved, chosen
          where memory_media.memory_id=saved.id and memory_media.couple_id=${actor.coupleId}::uuid and memory_media.asset_id=chosen.asset_id
        ), removed as (
          delete from memory_media using saved
          where memory_media.memory_id=saved.id and memory_media.couple_id=${actor.coupleId}::uuid
            and not exists(select 1 from chosen where chosen.asset_id=memory_media.asset_id)
        ), attached as (
          insert into memory_media (couple_id,memory_id,asset_id,attached_by,alt,position)
          select ${actor.coupleId}::uuid,saved.id,chosen.asset_id,${actor.userId},${parsed.data.title},chosen.position
          from saved cross join chosen
          where not exists(
            select 1 from memory_media existing
            where existing.memory_id=saved.id and existing.asset_id=chosen.asset_id
          )
        )`
      : sql`, removed as (
          delete from memory_media using saved
          where memory_media.memory_id=saved.id and memory_media.couple_id=${actor.coupleId}::uuid
        )`;
    const result = mode === "create"
      ? await db.execute(sql`
          with saved as (
            insert into ${memories} (id,couple_id,created_by,title,body,happened_on,location,is_milestone)
            select ${id.data}::uuid,${actor.coupleId}::uuid,${actor.userId},${parsed.data.title},${parsed.data.body},${parsed.data.happenedOn}::date,${parsed.data.location},${parsed.data.isMilestone}
            where exists(select 1 from ${coupleMembers} where ${coupleMembers.coupleId}=${actor.coupleId}::uuid and ${coupleMembers.userId}=${actor.userId})
            on conflict (id) do nothing returning id
          ) ${createAttachments}
          select exists(select 1 from saved) as saved
        `)
      : await db.execute(sql`
          with saved as (
            update ${memories}
            set title=${parsed.data.title},body=${parsed.data.body},happened_on=${parsed.data.happenedOn}::date,location=${parsed.data.location},is_milestone=${parsed.data.isMilestone},updated_at=now()
            where ${memoryScope(actor, id.data)} returning id
          ) ${editAttachments}
          select exists(select 1 from saved) as saved
        `);
    if (!result.rows[0]?.saved) return {message: mode === "create" ? "Already saved, or access changed. Return to Memories and check before trying again." : "This memory is no longer available."};
  } catch (error) {
    // Keep database details out of the page, but retain the actual cause in the
    // server log so a failed save can be diagnosed without guessing.
    console.error("memory-save-failed", error);
    return {message: "We couldn’t save this memory. Your text is still here; please try again."};
  }
  revalidatePath("/space", "layout");
  redirect(`/space/memories/${id.data}`);
}
export async function saveCouple(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await requireCouple();
  if (actor.role !== "owner") return {message: "Only the owner can change these settings."};
  const parsed = coupleInput.safeParse({name: form.get("name"), togetherSince: form.get("togetherSince"), timezone: form.get("timezone")});
  if (!parsed.success) return {message: "Please check these settings.", errors: z.flattenError(parsed.error).fieldErrors};
  try {
    const changed = await getDb().update(couples).set(parsed.data).where(and(eq(couples.id, actor.coupleId),
      sql`exists(select 1 from ${coupleMembers} where ${coupleMembers.coupleId}=${couples.id} and ${coupleMembers.userId}=${actor.userId} and ${coupleMembers.role}='owner')`)).returning({id: couples.id});
    if (!changed.length) return {message: "Your access has changed. Please sign in again."};
  } catch { return {message: "Settings couldn’t be saved. Please try again."}; }
  revalidatePath("/space", "layout");
  return {message: "Saved. Our space is up to date."};
}

export async function saveBirthday(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await requireCouple();
  const parsed = birthdayInput.safeParse({ birthday: form.get("birthday") });
  if (!parsed.success) return { message: "Please choose a valid birthday.", errors: z.flattenError(parsed.error).fieldErrors };
  try {
    await getDb().update(user).set({ birthday: parsed.data.birthday, updatedAt: new Date() }).where(eq(user.id, actor.userId));
  } catch {
    return { message: "Your birthday couldn’t be saved. Please try again." };
  }
  revalidatePath("/space/settings");
  return { message: parsed.data.birthday ? "Birthday saved for our little celebrations." : "Birthday removed." };
}
