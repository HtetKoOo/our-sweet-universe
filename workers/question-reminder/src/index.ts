export interface Env {
  APP_URL: string;
  QUESTION_REMINDER_SECRET: string;
}

type ScheduledContext = { waitUntil(promise: Promise<unknown>): void };

const reminderWorker = {
  async scheduled(_controller: unknown, env: Env, ctx: ScheduledContext) {
    const callJob = async (name: string, path: string) => {
      const response = await fetch(`${env.APP_URL}${path}`, {
        headers: { Authorization: `Bearer ${env.QUESTION_REMINDER_SECRET}` },
      });
      const body = await response.text();
      if (!response.ok) {
        console.error("scheduled-job-failed", { name, status: response.status, body });
        return;
      }
      console.log("scheduled-job-finished", { name, status: response.status, body });
    };
    ctx.waitUntil(
      Promise.all([
        callJob("question-reminder", "/api/jobs/question-reminder"),
        callJob("celebration-email", "/api/jobs/celebration-email"),
      ]),
    );
  },
};

export default reminderWorker;
