const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const reviews = require('../src/_data/customerReviews');

// Run after npm run build. Serve built files through request interception, no server needed.
async function main() {
    const browser = await chromium.launch({ headless: true });
    const output = path.resolve(__dirname, '../public');
    const screenshots = path.resolve(__dirname, '../.scratch/home-reviews-qa');
    await fs.mkdir(screenshots, { recursive: true });
    async function screenshotSection(page, section, name) {
        // The sticky site header otherwise overlays the cropped section screenshot.
        const style = await page.addStyleTag({ content: '#cs-navigation { visibility: hidden !important; }' });
        await section.screenshot({ path: path.join(screenshots, name) });
        await style.evaluate(el => el.remove());
    }
    async function pageFor(options = {}) {
        const context = await browser.newContext(options);
        await context.route('**/*', async route => {
            const url = new URL(route.request().url());
            if (url.origin !== 'https://squadv.test') return route.abort();
            const file = path.resolve(output, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
            if (!file.startsWith(output + path.sep)) return route.abort();
            try { await route.fulfill({ path: file }); } catch { await route.abort(); }
        });
        const page = await context.newPage();
        await page.goto('https://squadv.test/');
        return { context, page };
    }
    try {
        for (const width of [320, 375, 768, 1024, 1440]) {
            const { context, page } = await pageFor({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
            const section = page.locator('.sv-home-reviews');
            const slides = section.locator('[data-review]');
            assert.equal(await section.count(), 1);
            assert.equal(await page.locator('#reviews-67').count(), 0);
            assert.equal(await page.locator('#hero-143 + .sv-home-reviews').count(), 1);
            assert.equal(await slides.count(), reviews.items.length);
            assert.equal(await slides.filter({ visible: true }).count(), 1);
            assert.equal(await section.locator('[data-review-status]').textContent(), '');
            const previous = section.getByRole('button', { name: 'Previous review' });
            const next = section.getByRole('button', { name: 'Next review' });
            await next.focus();
            const heightBefore = await section.evaluate(el => el.getBoundingClientRect().height);
            await page.keyboard.press('Enter');
            assert.equal(await section.locator('[data-review-position]').textContent(), '2 of 5');
            assert.equal(await next.evaluate(el => el === document.activeElement), true);
            assert.match(await section.locator('[data-review-status]').textContent(), /Mervin Jude Herbano/);
            assert.equal(await section.evaluate(el => el.getBoundingClientRect().height), heightBefore);
            assert.equal(await section.evaluate(el => el.getAnimations({ subtree: true }).length), 0);
            for (let i = 0; i < reviews.items.length; i++) {
                const expected = reviews.items[(i + 1) % reviews.items.length];
                const active = section.locator('[data-review][aria-hidden="false"]');
                assert.equal((await active.locator('blockquote p').textContent()).replace(/\s+/g, ' '), expected.text.replace(/\s+/g, ' '));
                assert.equal(await active.locator('figcaption').textContent(), expected.author);
                assert.equal(await active.evaluate(el => el.inert), false);
                assert.equal(await section.locator('[data-review][aria-hidden="true"]').evaluateAll(els => els.every(el => el.inert)), true);
                assert.equal(await section.evaluate(el => [...el.querySelectorAll('*')].every(child => {
                    const box = child.getBoundingClientRect();
                    return box.width <= 1 || (box.left >= -1 && box.right <= innerWidth + 1);
                })), true, `Section overflow at ${width}px`);
                if (i === 0 && width === 375) await screenshotSection(page, section, 'mobile-long-review.png');
                await next.click();
            }
            await previous.click();
            assert.equal(await section.locator('[data-review-position]').textContent(), '1 of 5');
            await previous.click();
            assert.equal(await section.locator('[data-review-position]').textContent(), '5 of 5');
            await next.click();
            if (width === 1440) await screenshotSection(page, section, 'desktop-review.png');
            const columns = await section.locator('.sv-home-reviews-wrap').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
            assert.equal(columns, width < 768 ? 1 : 2);
            await context.close();
        }
        const { context, page } = await pageFor({ javaScriptEnabled: false, viewport: { width: 375, height: 900 } });
        assert.equal(await page.locator('[data-review]').filter({ visible: true }).count(), 5);
        assert.equal(await page.locator('[data-review-controls]').isHidden(), true);
        assert.equal(await page.locator('[data-enhanced]').count(), 0);
        await context.close();

        const motion = await pageFor({ reducedMotion: 'no-preference' });
        const animationCount = await motion.page.locator('[data-home-reviews]').evaluate(el => {
            el.querySelector('[data-review-direction="1"]').click();
            el.querySelector('[data-review-direction="-1"]').click();
            return el.getAnimations({ subtree: true }).length;
        });
        assert.equal(animationCount, 1, 'Rapid navigation should cancel the previous animation');
        await motion.context.close();

        const script = await fs.readFile(path.join(output, 'assets/js/home-reviews.js'), 'utf8');
        for (const count of [0, 1]) {
            const isolated = await browser.newPage();
            await isolated.setContent(`<div data-home-reviews>${'<figure data-review></figure>'.repeat(count)}<p data-review-position></p><p data-review-status></p><div data-review-controls hidden><button data-review-direction="-1"></button><button data-review-direction="1"></button></div></div>`);
            await isolated.addScriptTag({ content: script });
            assert.equal(await isolated.locator('[data-review-controls]').isHidden(), true);
            assert.equal(await isolated.locator('[data-enhanced]').count(), count);
            await isolated.close();
        }
        console.log('Homepage reviews passed: placement, exact content, keyboard and wraparound controls, announcements, stable height, 320–1440px layouts, reduced motion, no JS, zero and one review.');
    } finally {
        await browser.close();
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
