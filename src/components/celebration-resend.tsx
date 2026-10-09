"use client";

import { useActionState } from "react";
import {
  resendMissedMonthsary,
  type CelebrationResendState,
} from "@/app/space/settings/celebration-actions";

const initialState: CelebrationResendState = { message: "" };

export function CelebrationResend() {
  const [state, action, pending] = useActionState(resendMissedMonthsary, initialState);
  return (
    <section className="private-account">
      <h2>Missed yesterday’s monthly note?</h2>
      <p>Send one private monthsary email to each of you. This is available only on the day after your monthsary.</p>
      <form action={action}>
        <button className="button light" type="submit" disabled={pending}>
          {pending ? "Sending…" : "Resend yesterday’s note"}
        </button>
      </form>
      <p role="status" className="form-status">{state.message}</p>
    </section>
  );
}
