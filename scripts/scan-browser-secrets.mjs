import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const staticDir = path.join(root, ".next", "static");
const envPath = path.join(root, ".env.local");

if (!existsSync(staticDir)) {
  throw new Error("Missing .next/static. Run npm run build before npm run test:bundle-secrets.");
}

const privateEnvNames = ["SUPABASE_SECRET_KEY", "OPENAI_API_KEY", "CHAT_WIDGET_TOKEN_SECRET", "DATABASE_URL", "POSTGRES_URL", "RESEND_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"];
const forbiddenLiterals = ["sk-proj-", "service_role", "postgres://", "postgrestoken", "SUPABASE_SECRET_KEY", "OPENAI_API_KEY", "CHAT_WIDGET_TOKEN_SECRET", "RESEND_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "sk_live_", "sk_test_", "whsec_"];
const envValues = loadPrivateEnvValues(envPath, privateEnvNames);
const findings = [];

for (const file of walk(staticDir)) {
  if (!isScannable(file)) continue;

  const content = readFileSync(file, "utf8");
  for (const literal of forbiddenLiterals) {
    if (content.includes(literal)) {
      findings.push({ file, reason: `forbidden literal ${literal}` });
    }
  }

  for (const { name, value } of envValues) {
    if (content.includes(value)) {
      findings.push({ file, reason: `private env value ${name}` });
    }
  }
}

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`${path.relative(root, finding.file)}: ${finding.reason}`);
  }
  throw new Error("Browser bundle secret scan failed.");
}

console.log("Browser bundle secret scan passed.");

function loadPrivateEnvValues(file, names) {
  if (!existsSync(file)) return [];

  const values = [];
  const wanted = new Set(names);
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator === -1) continue;

    const name = line.slice(0, separator).trim();
    if (!wanted.has(name)) continue;

    const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (value.length >= 12) values.push({ name, value });
  }
  return values;
}

function* walk(directory) {
  for (const entry of readdirSync(directory)) {
    const file = path.join(directory, entry);
    const stats = statSync(file);
    if (stats.isDirectory()) {
      yield* walk(file);
    } else {
      yield file;
    }
  }
}

function isScannable(file) {
  return /\.(js|mjs|css|html|json|txt|map)$/.test(file);
}
