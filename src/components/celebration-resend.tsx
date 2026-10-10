"use client";

import { useActionState } from "react";
import {
  resendMissedMonthsary,
  type CelebrationResendState,
} from "@/app/space/settings/celebration-actions";

const initialState: CelebrationResendState = { message: "" };

export function CelebrationResend() {
  const [state, action, pending] = useActionState(resendMissedMonthsary, initialState);
  if (state.completed) return null;
  return (
    <section className="private-account">
      <h2>Missed a monthly note?</h2>
      <p>Send one private monthsary email to each of you. A missed monthsary can be resent within seven days.</p>
      <form action={action}>
        <button className="button light" type="submit" disabled={pending}>
          {pending ? "Sending…" : "Resend missed note"}
        </button>
      </form>
      <p role="status" className="form-status">{state.message}</p>
    </section>
  );
}
