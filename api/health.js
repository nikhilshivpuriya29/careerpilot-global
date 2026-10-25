export const access = "user";
export const methods = ["GET"];
export default async function (req, res) {
  // Private health response: expose no feature inventory or internal configuration.
  res.json({ ok: true, app: "CareerPilot" });
}