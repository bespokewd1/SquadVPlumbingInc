const fs = require("fs");
const path = require("path");

const postcss = require("postcss");
const tailwindcss = require("@tailwindcss/postcss");
const cssnano = require("cssnano");

const isProduction = process.env.ELEVENTY_ENV === "PROD";

const processor = postcss([tailwindcss(), ...(isProduction ? [cssnano({ preset: "default" })] : [])]);

module.exports = async function () {
    const inputPath = path.resolve("./src/tailwind/tailwind.css");
    const outputPath = path.resolve("./public/assets/css/tailwind.css");

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const source = fs.readFileSync(inputPath, "utf-8");

    try {
        const result = await processor.process(source, {
            from: inputPath,
            to: outputPath,
            map: isProduction
                ? false
                : {
                      inline: true,
                      annotation: true,
                  },
        });

        fs.writeFileSync(outputPath, result.css);
    } catch (error) {
        console.error(`Error processing ${inputPath}:`, error);
    }
};
