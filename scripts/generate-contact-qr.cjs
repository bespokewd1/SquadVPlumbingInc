const fs = require("node:fs/promises");
const path = require("node:path");
const QRCode = require("qrcode");
const { phoneForTel } = require("../src/_data/client");

const assetPath = path.join(__dirname, "../src/assets/images/contact-call-qr.svg");

async function main() {
    if (!/^\+[1-9]\d{1,14}$/.test(phoneForTel)) {
        throw new Error("client.phoneForTel must be an international phone number, including +.");
    }

    const svg = await QRCode.toString(`tel:${phoneForTel}`, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 4,
        width: 128,
        color: { dark: "#000000", light: "#ffffff" },
    });

    if (process.argv.includes("--check")) {
        const existing = await fs.readFile(assetPath, "utf8").catch((error) => {
            if (error.code === "ENOENT") return null;
            throw error;
        });
        // Git may check out the SVG with CRLF on Windows.
        if (existing?.replace(/\r\n/g, "\n") !== svg.replace(/\r\n/g, "\n")) {
            throw new Error("Contact QR is missing or out of date. Run npm run qr:generate and commit the updated SVG.");
        }
        console.log("Contact QR matches client.phoneForTel.");
        return;
    }

    await fs.mkdir(path.dirname(assetPath), { recursive: true });
    await fs.writeFile(assetPath, svg);
    console.log("Generated src/assets/images/contact-call-qr.svg from client.phoneForTel.");
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
