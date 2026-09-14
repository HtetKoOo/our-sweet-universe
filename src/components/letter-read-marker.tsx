"use client";
import { useEffect } from "react";
export function LetterReadMarker({ id, shouldMark }: { id: string; shouldMark: boolean }) {
  useEffect(() => { if (shouldMark) void fetch(`/api/letters/${id}/read`, { method: "POST" }); }, [id, shouldMark]);
  return null;
}
