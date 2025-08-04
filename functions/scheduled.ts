import { checkAllSites } from "./check";

export const onScheduled: ScheduledHandler = async (event, env, ctx) => {
  try {
    await checkAllSites(env, "scheduled");
  } catch (e) {
    console.error("Scheduled task error:", e);
  }
};
