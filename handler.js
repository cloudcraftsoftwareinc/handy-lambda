const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const Turndown = require('turndown')
const td = new Turndown()

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

function base64Decode(encodedStr) {
  return Buffer.from(encodedStr, 'base64').toString('utf8');
}
function base64Encode(str) {
  return Buffer.from(str, 'utf8').toString('base64');
}


async function fetchQuestions(page, search) {
  let result = ''
  search = search.split(' ').join('+')
  await page.goto('https://www.google.com/search?q=' + search, {
      waitUntil: 'networkidle2',  // Wait until the network is idle
      timeout: 15000,  // Set a timeout for loading the page
  });
  console.log('goto')

  return page.evaluate(async () => {
    const getQuestions = async function () {
      function getLast () {
        return Array.from(document.querySelectorAll('[data-qc] [data-bs] [role="button"] [jsname]:nth-of-type(2) [jsname]')).slice(-1).pop()
      }
      function getAllQuestions () {
        return Array.from(new Set(Array.from(document.querySelectorAll('[data-qc] [data-bs] [role="button"] span')).map(i => i.innerText)))
      }
      async function pause(time = 1000) {
        return new Promise((resolve, reject) => {
          setTimeout(resolve, time);
        });
      }
      let last = getLast();last.click(200);await pause();last.click();last = getLast()
      last.click(200);await pause();last.click();last = getLast();last.click(200);await pause()
      last.click();last = getLast();last.click(200);await pause();last.click();last = getLast()
      last.click(200);await pause();last.click();await pause()
      return getAllQuestions()
    }
    return getQuestions()
  });
}

function cleanMarkdown(content) {
  return content
  .replace(/\\n/g, '\n')  // Convert escaped newlines to actual newlines
  .replace(/\\x3C!--.*?--\\x3E/g, '')  // Remove HTML comments
  .replace(/\\\\/g, '')  // Remove double backslashes
  .replace(/\[\\n.*?\\n\]\(.*?\)/g, '')  // Remove empty markdown links
  .replace(/@supports.*?\}/gs, '')  // Remove CSS @supports rules
  .replace(/\.fe-block-.*?\{.*?\}/gs, '')  // Remove specific CSS rules
  .replace(/\.top-bun, \n .patty, \n .bottom-bun.*?\}/gs, '')  // Remove specific CSS rules
  .replace(/\\\[\\]/g, '')  // Remove escaped brackets
  .replace(/ x3C.*?x3E/g, '')  // Remove specific escaped characters
  .replace(/\[\s*\]/g, '')  // Remove empty brackets
  .replace(/\n{2,}/g, '\n\n')  // Replace multiple newlines with a single newline
  .replace(/[ \t]+/g, ' ')  // Replace multiple spaces/tabs with a single space
  .trim();  // Trim leading and trailing whitespace
}

function cleanHtml(content) {
  return content.replace(/<script.*?<\/script>/gs, '')
    .replace(/<style.*?<\/style>/gs, '')
}

function turnItDown(input) {
  const md = td.turndown(cleanHtml(input))
  return cleanMarkdown(md)
}

async function fetchSource(page, url) {
  const response = await page.goto(url)
  return response.text()
}


exports.scrape = async (event) => {
    let result = null;
    let browser = null;

    console.log("event", event);

    try {
        browser = await puppeteer.launch({
            args: [
              ...chromium.args,
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-accelerated-2d-canvas',
              '--disable-gpu',
              '--single-process',
              '--disable-web-security',
              '--font-render-hinting=none',
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,  // Ignore HTTPS errors
            devtools: false,  // Disable devtools
            timeout: 30000,  // Set a timeout for launching the browser
            pipe: true,
        });
        console.log('launched')
        
        
        if (event.action == 'fetchQuestions') {
          const page = await browser.newPage();
          console.log('fetchQuestions')
          result = await fetchQuestions(page, event.search)
        } else
        if (event.action == 'htmlToMarkdown') {
          console.log('turndown')
          const input = base64Decode(event.input)
          result = base64Encode(turnItDown(input))
        } else {
          const page = await browser.newPage();
          console.log('fetchSource')
          // default is fetchSource
          result = await fetchSource(page, event.url)
        }

    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to scrape the page' }),
        };
    } finally {
        if (browser !== null) {
            await browser.close();
        }
    }

    console.log('return')

    return {
        statusCode: 200,
        body: JSON.stringify({ response: result }),
    };
};