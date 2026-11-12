const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

// Run fresh processes so each filter sees a different build-machine timezone
// and locale. Midnight UTC previously rendered as the preceding day in Edmonton.
const cases = [
    ["2026-04-13T00:00:00.000Z", "Apr 13, 2026"],
    ["2026-09-01T00:00:00.000Z", "Sep 1, 2026"],
    ["2026-09-08T00:00:00.000Z", "Sep 8, 2026"],
    ["2026-09-15T00:00:00.000Z", "Sep 15, 2026"],
    ["2026-03-08T00:00:00.000Z", "Mar 8, 2026"],
    ["2026-11-01T00:00:00.000Z", "Nov 1, 2026"],
];
const probe = `
    const postDate = require('./src/config/filters/postDate');
    const isoDate = require('./src/config/filters/isoDate');
    const cases = ${JSON.stringify(cases)};
    process.stdout.write(JSON.stringify(cases.map(([value]) => {
        const date = new Date(value);
        return [postDate(date), isoDate(date)];
    })));
`;
const expected = cases.map(([iso, display]) => [display, iso]);
for (const tz of ["UTC", "America/Edmonton", "Asia/Manila"]) {
    for (const locale of ["en_CA.UTF-8", "fr_CA.UTF-8"]) {
        const actual = JSON.parse(execFileSync(process.execPath, ["-e", probe], {
            cwd: path.join(__dirname, ".."),
            env: { ...process.env, TZ: tz, LANG: locale, LC_ALL: locale },
            encoding: "utf8",
        }));
        assert.deepEqual(actual, expected, `${tz}, ${locale}`);
    }
}
console.log("Blog dates preserve their UTC calendar day and en-CA display across 3 timezones and 2 locales.");
