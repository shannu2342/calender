import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getProkeralaAccessToken, getProkeralaCredentialCount } from "../services/prokeralaAuth.js";
import { prokeralaGet } from "../services/prokeralaService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

function buildDefaultDatetime() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T12:00:00+05:30`;
}

async function main() {
  const credentialCount = getProkeralaCredentialCount();
  console.log(`[Verify] Found ${credentialCount} Prokerala credential set(s).`);

  const token = await getProkeralaAccessToken({ credentialIndex: 0, forceRefresh: true });
  console.log(`[Verify] Access token fetched successfully (length: ${token.length}).`);

  const coordinates = process.env.PROKERALA_TEST_COORDINATES || "17.3934,78.4706";
  const datetime = process.env.PROKERALA_TEST_DATETIME || buildDefaultDatetime();
  const ayanamsa = Number(process.env.PROKERALA_TEST_AYANAMSA || 1);
  const la = process.env.PROKERALA_TEST_LANGUAGE || "en";

  const payload = await prokeralaGet("/astrology/panchang", {
    coordinates,
    datetime,
    ayanamsa,
    la,
  });

  if (payload?.status === "ok") {
    console.log("[Verify] Sample authenticated API call succeeded: /astrology/panchang");
    console.log(`[Verify] Vaara: ${payload?.data?.vaara || "n/a"}`);
    return;
  }

  console.log("[Verify] Token worked, but sample response shape was unexpected.");
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((err) => {
  console.error("[Verify] Prokerala auth verification failed.");
  console.error(err?.message || err);
  if (err?.details) {
    console.error("[Verify] Details:", JSON.stringify(err.details, null, 2));
  }
  process.exit(1);
});

