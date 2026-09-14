"use server";
import { revalidatePath } from "next/cache";
import { requireCouple } from "@/lib/authorization";
import { getDb } from "@/lib/db";
import { letters } from "@/lib/db/schema";
import { letterInput } from "@/lib/letter-input";
export type LetterActionState = { message: string };
export async function sendLoveLetter(_previous: LetterActionState, form: FormData): Promise<LetterActionState> {
  const actor = await requireCouple();
  const parsed = letterInput.safeParse({ title: form.get("title"), body: form.get("body") });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Please check this letter." };
  try { await getDb().insert(letters).values({ coupleId: actor.coupleId, createdBy: actor.userId, ...parsed.data }); }
  catch (error) { console.error("love-letter-send-failed", error); return { message: "Your letter is still here. Please try again." }; }
  revalidatePath("/space/letters");
  return { message: "Your letter is waiting for your person." };
}
