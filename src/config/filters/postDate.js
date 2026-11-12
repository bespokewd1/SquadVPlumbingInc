const { DateTime } = require("luxon");

module.exports = function (dateObj) {
    // Editorial dates are stored at midnight UTC. Preserve their calendar day
    // even when the build runs in Edmonton or another local timezone.
    return DateTime.fromJSDate(dateObj, { zone: "utc" })
        .setLocale("en-CA")
        .toLocaleString(DateTime.DATE_MED);
};
