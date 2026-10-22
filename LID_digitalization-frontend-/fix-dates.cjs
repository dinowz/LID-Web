const fs = require("fs");
const path = require("path");

const targetDirs = [
  "Service/Inquiries", "Service/Quotations", "Service/PO", "Service/Executions",
  "Project/Inquiries", "Project/Quotations", "Project/PO", "Project/Executions",
  "Sparepart/Inquiries", "Sparepart/Quotations", "Sparepart/PO", "Sparepart/Delivery",
  "Finance/Invoices"
];

let filesToProcess = [];
targetDirs.forEach(dir => {
  const fullPath = path.join("src/pages", dir, "List.jsx");
  if (fs.existsSync(fullPath)) filesToProcess.push(fullPath);
});

const rtiPath = path.join("src/pages", "Finance/Invoices", "ReadyToInvoice.jsx");
if (fs.existsSync(rtiPath)) filesToProcess.push(rtiPath);

filesToProcess.forEach(file => {
  let content = fs.readFileSync(file, "utf8");
  let modified = false;

  if (!content.includes("dayjs/plugin/customParseFormat")) {
    content = content.replace(
      /import isSameOrAfter from .dayjs\/plugin\/isSameOrAfter.;\r?\n/,
      "import isSameOrAfter from \x27dayjs/plugin/isSameOrAfter\x27;\nimport customParseFormat from \x27dayjs/plugin/customParseFormat\x27;\n"
    );
    content = content.replace(
      /dayjs\.extend\(isSameOrAfter\);\r?\n/,
      "dayjs.extend(isSameOrAfter);\ndayjs.extend(customParseFormat);\n"
    );
    modified = true;
  }

  if (/const start = dayjs\(params\.[a-zA-Z0-9]+\);/.test(content)) {
    content = content.replace(
      /const start = dayjs\(params\.([a-zA-Z0-9]+)\);/g,
      "const start = dayjs(params.$1, [\x27DD/MM/YYYY\x27, \x27YYYY-MM-DD\x27]).startOf(\x27day\x27);"
    );
    content = content.replace(
      /const end = dayjs\(params\.([a-zA-Z0-9]+)\);/g,
      "const end = dayjs(params.$1, [\x27DD/MM/YYYY\x27, \x27YYYY-MM-DD\x27]).endOf(\x27day\x27);"
    );
    modified = true;
  }

  if (/d\.isSameOrAfter\(start,\s*\x27day\x27\)/.test(content)) {
    content = content.replace(
      /d\.isSameOrAfter\(start,\s*\x27day\x27\)\s*&&\s*d\.isSameOrBefore\(end,\s*\x27day\x27\)/g,
      "d.isSameOrAfter(start) && d.isSameOrBefore(end)"
    );
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(file, content, "utf8");
    console.log("Fixed", file);
  }
});

