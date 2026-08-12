module.exports = {
  name: "Squad V Plumbing Inc.",
  brandName: "SquadV Plumbing",
  primaryEmail: "office@squadvplumbing.ca",
  secondaryEmail: "SQUADV726@gmail.com",
  // Backward-compatible aliases while templates move to the explicit names.
  email: "office@squadvplumbing.ca",
  officeEmail: "office@squadvplumbing.ca",
  phoneForTel: "+17806677169",
  phoneFormatted: "(780)-667-7169",
  phoneDisplay: "780-667-7169",
  whatsappLink: "https://wa.me/17806677169",
  address: {
    lineOne: "432 Dunluce Rd. NW",
    lineTwo: "",
    city: "Edmonton",
    state: "AB",
    country: "CA",
    display: "432 Dunluce Rd. NW, Edmonton, AB",
    mapLink: "https://maps.app.goo.gl/bgxAMTNBtFAxm4H47",
  },
  hours: {
    display: "Monday – Friday, 7 AM – 5 PM",
    weekdays: "Mo-Fr 07:00-17:00",
  },
  serviceArea: "Edmonton and surrounding areas",
  googleBusiness: "https://maps.app.goo.gl/bgxAMTNBtFAxm4H47",
  socials: {
    facebook: "https://www.facebook.com/squadvplumbing/",
  },
  domain: "https://www.squadvplumbing.ca",
  defaultOgImage: "/assets/images/OG.webp",
  isProduction: process.env.ELEVENTY_ENV === "PROD",
};
