require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const xss = require("xss-clean");
const bodyParser = require("body-parser");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");
const pdf = require("html-pdf");
const redis = require("redis");
const redisClient = redis.createClient();
const { promisify } = require("util");
const app = express();
redisClient.set = promisify(redisClient.set);
redisClient.get = promisify(redisClient.get);
redisClient.flushall = promisify(redisClient.flushall);
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
  try {
    const files = [];
    const promise = [];
    fs.readdirSync(dir).map((x) => files.push(x));
    files.forEach(async (file) => {

      /** getting filename from redis */
      const data = await redisClient.get(file);

      /** if filename exists then don't proceed with this file as it must be taken by another process */
      if (!data) {

        /** set the value in redis */
        await redisClient.set(file, 1);
        const html = fs.readFileSync(
          path.join(__dirname, `./upload/${file}`),
          "utf-8"
        );
        const filePath = path.join(
          __dirname,
          `./upload/${file.split(".")[0]}.pdf`
        );
        promise.push(createPdfPromise(filePath, html));
      }
    });
    
    /** after the process is done then remove all values from redis */
    await redisClient.flushall();
    await Promise.all(promise);

    res
      .status(200)
      .json({ statusCode: 200, message: "Task done successfully!" });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      message: "Something went wrong",
    });
  }
});

// promisifying the function
const createPdfPromise = (filePath, html) => {
  return new Promise((resolve, reject) => {
    pdf.create(html).toFile(filePath, (err, data) => {
      if (err) {
        reject(err);
      }
      resolve(data);
    });
  });
};

const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log(`Server listening at port ${port}`);
});
