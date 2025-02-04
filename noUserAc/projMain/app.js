const puppeteer = require('puppeteer');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const API_KEY = 'e1b6a32b7f0502fcb086a3a22fe69ceb'; 

async function solveCaptchaWith2Captcha(imageUrl) {
    const response = await fetch(imageUrl);
    const buffer = await response.buffer();
    const filePath = path.join(__dirname, 'captcha.png');
    fs.writeFileSync(filePath, buffer);

    const formData = new FormData();
    formData.append('key', API_KEY);
    formData.append('method', 'post');
    formData.append('file', fs.createReadStream(filePath));

    const captchaResponse = await fetch('http://2captcha.com/in.php', {
        method: 'POST',
        body: formData,
    });

    const captchaId = await captchaResponse.text();
    if (!captchaId.includes('OK')) {
        throw new Error('Failed to upload captcha to 2Captcha');
    }

    const captchaIdTrimmed = captchaId.split('|')[1];

    let solvedCaptcha;
    while (!solvedCaptcha) {
        await new Promise(r => setTimeout(r, 5000));
        const resultResponse = await fetch(`http://2captcha.com/res.php?key=${API_KEY}&action=get&id=${captchaIdTrimmed}`);
        const resultText = await resultResponse.text();
        if (resultText.includes('OK')) {
            solvedCaptcha = resultText.split('|')[1];
        } else if (resultText === 'CAPCHA_NOT_READY') {
            console.log('Captcha not solved yet, retrying...');
        } else {
            throw new Error('Error solving captcha: ' + resultText);
        }
    }

    fs.unlinkSync(filePath);
    return solvedCaptcha;
}

async function solveRecaptchaWith2Captcha(siteKey, pageUrl) {
    const captchaResponse = await fetch(`http://2captcha.com/in.php?key=${API_KEY}&method=userrecaptcha&googlekey=${siteKey}&pageurl=${pageUrl}`, {
        method: 'POST',
    });
    const captchaId = await captchaResponse.text();
    const captchaIdTrimmed = captchaId.split('|')[1];

    let solvedCaptcha;
    while (!solvedCaptcha) {
        await new Promise(r => setTimeout(r, 5000));
        const resultResponse = await fetch(`http://2captcha.com/res.php?key=${API_KEY}&action=get&id=${captchaIdTrimmed}`);
        const resultText = await resultResponse.text();
        if (resultText.includes('OK')) {
            solvedCaptcha = resultText.split('|')[1];
        } else if (resultText === 'CAPCHA_NOT_READY') {
            console.log('Captcha not solved yet, retrying...');
        } else {
            throw new Error('Error solving captcha: ' + resultText);
        }
    }

    return solvedCaptcha;
}

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    const site = 'innetads';

    switch (site) {
        case 'innetads':
            await page.goto('http://www.innetads.com/post/post-free-ads.php', { waitUntil: 'networkidle2' });

            await page.waitForSelector('input[name="adTitle"]');
            await page.type('input[name="adTitle"]', 'Your Business Name');
            await page.waitForSelector('textarea[name="adDescription"]');
            await page.type('textarea[name="adDescription"]', 'Description hehe...');
            await page.waitForSelector('select[name="category"]');
            await page.select('select[name="category"]', 'Automobiles & Vehicles - Auto Dealers');
            await page.waitForSelector('input[name="ownerName"]');
            await page.type('input[name="ownerName"]', 'Your Name');
            await page.waitForSelector('input[name="contactPhone"]');
            await page.type('input[name="contactPhone"]', '9999999999');
            await page.waitForSelector('input[name="contactEmail"]');
            await page.type('input[name="contactEmail"]', 'youremail@example.com');

            await page.waitForSelector('img[src*="free-ads-rand_num_image.php"]');
            const captchaSrc = await page.evaluate(() => document.querySelector('img[src*="free-ads-rand_num_image.php"]').src);

            const captchaText = await solveCaptchaWith2Captcha(captchaSrc);
            console.log('Captcha solved:', captchaText);

            await page.waitForSelector('input[name="validationCode"]');
            await page.type('input[name="validationCode"]', captchaText);
            await page.waitForSelector('input[type="submit"]');
            await page.click('input[type="submit"]');

            console.log('Form submitted.');
            break;

        case 'postherefree':
            await page.goto('https://postherefree.com/', { waitUntil: 'networkidle2' });
            await page.waitForSelector('input[name="userName"]');
            await page.type('input[name="userName"]', 'Your Business Name');
            await page.waitForSelector('input[name="email"]');
            await page.type('input[name="email"]', 'youremail@example.com');
            await page.waitForSelector('textarea[name="content"]');
            await page.type('textarea[name="content"]', 'Your business description...');
            await page.waitForSelector('select[name="category"]');
            await page.select('select[name="category"]', 'category_value_here');
            await page.waitForSelector('button[type="submit"]');
            await page.click('button[type="submit"]');
            break;


        default:
            console.log('Site not recognized. Please check the site name.');
            break;
    }

    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    const listingLink = await page.evaluate(() => document.location.href);

    console.log(`${site} Listing URL:`, listingLink);

    await browser.close();
})();
