const fs = require("fs");
const { execSync } = require("child_process");

const INDEX_PATH = "index.html";
const TARGET_REGEX = /const BUILD_UPDATED_DATE = "[^"]*";/;

function getLatestCommitIsoDate() {
  try {
    return execSync("git log -1 --format=%cI", { encoding: "utf8" }).trim();
  } catch {
    return new Date().toISOString();
  }
}

function formatDate(isoString) {
  const date = new Date(isoString);
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(validDate);
}

function stampIndex(dateString) {
  const source = fs.readFileSync(INDEX_PATH, "utf8");
  const replacement = `const BUILD_UPDATED_DATE = "${dateString}";`;

  if (!TARGET_REGEX.test(source)) {
    throw new Error("BUILD_UPDATED_DATE constant not found in index.html");
  }

  const updated = source.replace(TARGET_REGEX, replacement);
  fs.writeFileSync(INDEX_PATH, updated, "utf8");
}

const isoDate = getLatestCommitIsoDate();
const formatted = formatDate(isoDate);
stampIndex(formatted);
console.log(`Stamped build date: ${formatted}`);
