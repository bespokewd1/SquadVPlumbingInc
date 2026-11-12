// Manually checked against the expanded Google Maps reviews on November 13, 2026.
// Keep original spelling and punctuation. Google only exposed these five of eight reviews.
// Do not infer absolute publication dates from Google's relative dates.
const byId = {
    martin: {
        author: "Martin Szijjarto",
        rating: 5,
        text: "Eugene is fast to respond and provides a fast turn around time. Will definitely use in the future.",
    },
    mervin: {
        author: "Mervin Jude Herbano",
        rating: 5,
        text: "Highly recommend! We had a major leak in our basement and SquadV Plumbing came out the same day. Allan and Eugene was incredibly professional, explained exactly what went wrong, and fixed it quickly. They kept everything clean and the final price matched the estimate perfectly. It is hard to find honest, reliable plumbing service, but these guys nailed it. Will absolutely call them again for any heating or plumbing needs!",
    },
    michael: {
        author: "Michael Varkovetski (Gonsar)",
        rating: 5,
        text: "Called for a consultation and was provided with free advise that immediately solved my small leak. Thank you so much!",
    },
    kuh: {
        author: "Kuh Chellica Lacabe",
        rating: 5,
        text: "Prompt and professional!\nOur furnace modulating gas valve did not work since Thursday night. I contacted other furnace company and tried to sell me a new furnace. I checked facebook marketplace and found Eugene Friday night. I messaged him at 12 midnight and he responded soon. We get to have it replaced in 30 minutes. Thank you so much for the awesome service!",
    },
    paul: {
        author: "Paul Vista",
        rating: 5,
        text: "Professional and quick response!!!! Definitely recommend the services to my friends.",
    },
};

module.exports = {
    sourceUrl: "https://www.google.com/maps?cid=6085530453447574694",
    verifiedOn: "2026-11-13",
    byId,
    items: Object.values(byId),
};
