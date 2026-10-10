const fs = require('fs');
const pdfParse = require('pdf-parse');

async function main() {
  const filePath = process.argv[2];
  if (!filePath || !fs.existsSync(filePath)) {
    process.stderr.write('File path required or file not found\n');
    process.exit(1);
  }

  const buf = fs.readFileSync(filePath);
  const pages = [];
  const options = {
    pagerender: (pageData) => {
      return pageData.getTextContent().then((textContent) => {
        let lastY;
        let text = '';
        for (const item of (textContent.items || [])) {
          if (lastY === undefined || lastY === item.transform[5]) {
            text += (text.length > 0 && !text.endsWith(' ') ? ' ' : '') + item.str;
          } else {
            text += '\n' + item.str;
          }
          lastY = item.transform[5];
        }
        pages.push({
          pageNumber: pageData.pageIndex + 1,
          text
        });
        return text;
      });
    }
  };

  try {
    const res = await pdfParse(buf, options);
    const result = {
      pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: res.text || '' }],
      fullText: res.text || ''
    };
    process.stdout.write(JSON.stringify(result));
    process.exit(0);
  } catch (err) {
    // Try without options
    try {
      const resFallback = await pdfParse(buf);
      const resultFallback = {
        pages: [{ pageNumber: 1, text: resFallback.text || '' }],
        fullText: resFallback.text || ''
      };
      process.stdout.write(JSON.stringify(resultFallback));
      process.exit(0);
    } catch (errFallback) {
      process.stderr.write(errFallback.message || 'Error extracting PDF');
      process.exit(1);
    }
  }
}

main();
