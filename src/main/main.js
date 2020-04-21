const fs = require("fs");
const util = require("util");
const fetch = require("node-fetch");
const DOMParser = require("xmldom").DOMParser;
const path = require("path");
const parser = new DOMParser({ errorHandler: () => {} });
const streamPipeline = util.promisify(require("stream").pipeline);
const d3Dsv = require("d3-dsv");
const os = require("os");
const { app, BrowserWindow, ipcMain, nativeTheme } = require("electron");
let windows;
function createWindow() {
    // Tarayıcı penceresini oluştur.
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
        },
    });

    // and load the index.html of the app.
    win.loadFile(__dirname + "/../renderer/index.html");

    // DevTools'u aç.
    win.webContents.openDevTools();
    windows = win;
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Bazı API'ler sadece bu olayın gerçekleşmesinin ardından kullanılabilir.
app.whenReady().then(createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", () => {
    // MacOS'de kullanıcı CMD + Q ile çıkana dek uygulamaların ve menü barlarının
    // aktif kalmaya devam etmesi normaldir.
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    // MacOS'de dock'a tıklandıktan sonra eğer başka pencere yoksa
    // yeni pencere açılması normaldir.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// In this file you can include the rest of your app's specific main process
// code. Ayrıca bunları ayrı dosyalara koyabilir ve buradan isteyebilirsiniz.
let parsedData;
function get_file(file) {
    const fileRawData = fs.readFileSync(file, "utf8");
    parsedData = d3Dsv.dsvFormat("\t").parse(fileRawData);
    return parsedData;
}
async function getFileHTML(doi) {
    return await fetch(`https://sci-hub.im/${doi}`).then((r) => r.text());
}
async function download(url, name) {
    const response = await fetch(url);
    const ext = response.headers.get("content-type") === "application/pdf" ? "pdf" : "txt";
    if (ext === "pdf") {
        if (!response.ok) throw new Error(`unexpected response ${response.statusText}`);
        await streamPipeline(
            response.body,
            fs.createWriteStream(
                path.resolve(
                    os.homedir(),
                    "Desktop",
                    "downloads",
                    `${name.replace(/[^0-9a-zA-Z\(\)_]+/g, "_")}.${ext}`,
                ),
            ),
        );
        console.log(name, `Downloaded ${Math.round(response.headers.get("content-length") / 1000000)}MB`);
    } else {
        windows.webContents.send("not-downloaded", item["DI"]);
    }
}
ipcMain.on("load-file-to-csv-parse", (event, path) => {
    event.returnValue = get_file(path);
});

ipcMain.on("start-download", async (event) => {
    const list = parsedData;
    for (let i = 0; i < list.length; i++) {
        if (list[i]["DI"]) {
            const item = list[i];
            const htmlString = await getFileHTML(item["DI"]);
            const dom = parser.parseFromString(htmlString);
            const frameElement = dom.getElementsByTagName("iframe")[0];
            if (frameElement) {
                const source = frameElement.getAttribute("src");
                const url = `${source.startsWith("//") ? "https:" : ""}${
                    frameElement.getAttribute("src").split("#")[0]
                }`;
                if (!fs.existsSync(path.resolve(os.homedir(), "Desktop", "downloads"))) {
                    fs.mkdirSync(path.resolve(os.homedir(), "Desktop", "downloads"));
                }
                try {
                    await download(url, item["TI"]);
                    windows.webContents.send("downloaded", item["DI"]);
                } catch (error) {
                    console.error(error);
                }
            } else {
                windows.webContents.send("not-downloaded", item["DI"]);
                if (!fs.existsSync(path.resolve(os.homedir(), "Desktop", "logs"))) {
                    fs.mkdirSync(path.resolve(os.homedir(), "Desktop", "logs"));
                    fs.writeFileSync(
                        path.resolve(os.homedir(), "Desktop", "logs", "errors.log"),
                        `${list.columns.join(";")}\n`,
                    );
                }
                fs.appendFileSync(
                    path.resolve(os.homedir(), "Desktop", "logs", "errors.log"),
                    `${list.columns.map((c) => item[c]).join(";")}\n`,
                );
            }
        }
    }
});
