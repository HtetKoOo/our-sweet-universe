export interface Env {
  APP_URL: string;
  QUESTION_REMINDER_SECRET: string;
}

type ScheduledContext = { waitUntil(promise: Promise<unknown>): void };

const reminderWorker = {
  async scheduled(_controller: unknown, env: Env, ctx: ScheduledContext) {
    ctx.waitUntil(
      Promise.all([
        fetch(`${env.APP_URL}/api/jobs/question-reminder`, { headers: { Authorization: `Bearer ${env.QUESTION_REMINDER_SECRET}` } }),
        fetch(`${env.APP_URL}/api/jobs/celebration-email`, { headers: { Authorization: `Bearer ${env.QUESTION_REMINDER_SECRET}` } }),
      ]),
    );
  },
};

export default reminderWorker;
