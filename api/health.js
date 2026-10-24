export const access = "public";
export const methods = ["GET"];
export default async function (req, res) {
  res.json({
    ok: true,
    app: "CareerPilot",
    version: "1.0",
    features: ["job-search-links", "visa-aware-filters", "resume-draft", "application-tracker", "profile-editor"],
    note: "Job entries are starter search leads, not verified live vacancies."
  });
}