const ipc = require("electron").ipcRenderer;

const root = document.getElementById("root");
const list = document.createElement("ul");
let filePath;
const createListItem = (datum, ...inner) => {
    const item = document.createElement("li");
    inner.forEach((i) => item.appendChild(i));
    const button = document.createElement('button');
    button.innerHTML = 'Download'
    button.onclick = () => {
        ipc.send("single-download", {
            item: datum,
            id: datum["DI"]
        });
    }
    item.appendChild(button);
    return item;
};
const div = (i) => {
    const s = document.createElement("div");
    s.innerHTML = i;
    return s;
};
const startButton = document.createElement("button");
startButton.innerHTML = "START Download";
startButton.onclick = () => {
    if (filePath !== undefined) {
        ipc.send("start-download");
    }
};
const input = document.createElement("input");
input.setAttribute("id", "fileSelect");
input.setAttribute("type", "file");

input.onchange = (e) => {
    const target = e.target;
    console.log(target.files[0].path);
    const parsedData = ipc.sendSync("load-file-to-csv-parse", target.files[0].path);
    filePath = parsedData;
    parsedData.forEach((datum) => {
        const item = createListItem(datum, div(datum["DI"]), div(datum["TI"]), div(datum["PY"]), div(datum["AU"]));
        item.id = datum["DI"];
        item.style.border = "1px solid #f2f2f2";
        item.style.padding = "2px";
        item.style.marginTop = "2px";
        list.appendChild(item);
    });
};
ipc.on("downloaded", (event, di) => {
    console.log("downloaded", di)
    const listItem = document.getElementById(di);
    listItem.style.backgroundColor = "green";
});
ipc.on("not-downloaded", (event, di) => {
    console.log("not-downloaded", di)
    const listItem = document.getElementById(di);
    listItem.style.backgroundColor = "red";
});
root.appendChild(startButton);
root.appendChild(input);
root.appendChild(list);
