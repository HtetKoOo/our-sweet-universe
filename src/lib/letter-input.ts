import { z } from "zod";

export const letterInput = z.object({
  title: z.string().trim().min(1, "Give this letter a title.").max(120),
  body: z.string().trim().min(1, "Write a little before sending.").max(10000),
});
