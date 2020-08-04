require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const xss = require("xss-clean");
const bodyParser = require("body-parser");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");
const pdf = require('html-pdf');
const app = express();

(function () {
  // prevention of DOS attack by preventing the actual payload data
  app.use(express.json({ limit: "10kb" }));
  // preventing cors error
  app.use(cors());

  app.use(helmet());
  app.use(xss());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());
})();

const dir = path.join(__dirname, "./upload");
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

// prevention of brute force attack by rate limiting
const limit = rateLimit({
  max: 100, // max requests
  windowMs: 60 * 60 * 1000, // 1 Hour of 'ban' / lockout
  message: "Too many requests", // message to send
});
app.get("/convert", async (req, res) => {
  const files = [];
  const promise = [];
  fs.readdirSync(dir).map((x) => files.push(x));
  files.forEach(file => {
    console.log(path.join(__dirname, `./upload/${file.split('.')[0]}.pdf`))
    const html = fs.readFileSync(path.join(__dirname, `./upload/${file}`), 'utf-8');
    const filePath = path.join(__dirname, `./upload/${file.split('.')[0]}.pdf`);
    promise.push(createPdfPromise(filePath, html));
  });
  await Promise.all(promise);
  
  res.status(200).json({ files });
});

// promisifying the function
const createPdfPromise = (filePath, html) => {
  return new Promise((resolve, reject) => {
    pdf.create(html).toFile(filePath, (err, data) => {
      if (err) {
        reject(err);
      }
      resolve(data);
    })
  })
}

const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log(`Server listening at port ${port}`);
});
