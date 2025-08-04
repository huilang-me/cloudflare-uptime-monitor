export function getBeijingTimeISOString(): string {
  const now = new Date();
  now.setUTCHours(now.getUTCHours() + 8);
  return now.toISOString().replace("T", " ").replace("Z", "");
}
