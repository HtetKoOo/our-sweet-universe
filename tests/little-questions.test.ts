import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarDate, isQuestionTime, localClock } from "../src/lib/dates";
import { littleQuestionSeed } from "../src/lib/little-question-seed";

test("the starter bank contains the 83 distinct Burmese questions", () => {
  assert.equal(littleQuestionSeed.length, 83);
  assert.equal(
    new Set(littleQuestionSeed.map(([, prompt]) => prompt)).size,
    83,
  );
});

test("question time follows the couple timezone, not the server clock", () => {
  const justBeforeNoonBangkok = new Date("2026-09-10T04:59:00Z");
  const noonBangkok = new Date("2026-09-10T05:00:00Z");
  assert.deepEqual(localClock(justBeforeNoonBangkok, "Asia/Bangkok"), {
    hour: 11,
    minute: 59,
  });
  assert.equal(isQuestionTime(justBeforeNoonBangkok, "Asia/Bangkok"), false);
  assert.equal(isQuestionTime(noonBangkok, "Asia/Bangkok"), true);
  assert.equal(calendarDate(noonBangkok, "Asia/Bangkok"), "2026-09-10");
});
