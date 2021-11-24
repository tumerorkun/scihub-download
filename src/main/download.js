#!/usr/bin/env node

const util = require("util");
const fs = require("fs");
// const https = require('https');
const streamPipeline = util.promisify(require("stream").pipeline);
const fetch = require("node-fetch");
const DOMParser = require("xmldom").DOMParser;
const path = require("path");
const parser = new DOMParser({ errorHandler: () => { } });
const d3Dsv = require("d3-dsv");
// const agent = new https.Agent({
//     rejectUnauthorized: false,
// });
async function getFileHTML(doi) {
    return await fetch(`https://sci-hub.se/${doi}`).then((r) => r.text()).catch(e => console.log(e));
}
async function download(url, name) {
    const response = await fetch(url);
    const ext = response.headers.get("content-type") === "application/pdf" ? "pdf" : "txt";
    if (ext === "pdf") {
        if (!response.ok) throw new Error(`unexpected response ${response.statusText}`);
        await streamPipeline(
            response.body,
            fs.createWriteStream(
                path.resolve(process.cwd(), "downloads", `${name.replace(/[^0-9a-zA-Z\(\)_]+/g, "_")}.${ext}`),
            ),
        );
        console.log(name, `Downloaded ${Math.round(response.headers.get("content-length") / 1000000)}MB`);
    }
}
function get_file(file) {
    const fileRawData = fs.readFileSync(file, "utf8");
    return d3Dsv.dsvFormat("\t").parse(fileRawData);
}
async function main(arg) {
    const list = get_file(arg);
    for (let i = 0; i < list.length; i++) {
        if (list[i]["DI"]) {
            const item = list[i];
            const htmlString = await getFileHTML(item["DI"]);
            const dom = parser.parseFromString(htmlString);
            const frameElement = dom.getElementsByTagName("embed")[0];
            if (frameElement) {
                const source = frameElement.getAttribute("src");
                const url = `${source.startsWith("//") ? "https:" : ""}${frameElement.getAttribute("src").split("#")[0]
                    }`;
                if (!fs.existsSync(path.resolve(process.cwd(), "downloads"))) {
                    fs.mkdirSync(path.resolve(process.cwd(), "downloads"));
                }
                try {
                    await download(url, item["TI"]);
                } catch (error) {
                    console.error(error);
                }
            } else {
                if (!fs.existsSync(path.resolve(process.cwd(), "logs"))) {
                    fs.mkdirSync(path.resolve(process.cwd(), "logs"));
                    fs.writeFileSync(path.resolve(process.cwd(), "logs", "errors.log"), `${list.columns.join(";")}\n`);
                }
                fs.appendFileSync(
                    path.resolve(process.cwd(), "logs", "errors.log"),
                    `${list.columns.map((c) => item[c]).join(";")}\n`,
                );
            }
        }
    }
}
main(process.argv[2]);
