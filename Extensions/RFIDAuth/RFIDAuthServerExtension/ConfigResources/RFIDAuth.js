function websocketConnection() {
    const wsDomain = window.hmiWsEndpoint();
    const ws = new WebSocket(wsDomain);
    const send = (req) => new Promise((resolve, reject) => {
        if (ws.readyState !== 1) {
            reject("Websocket not available");
        }

        req.id = Math.round(Math.random() * Number.MAX_SAFE_INTEGER);
        ws.send(JSON.stringify(req));
        const callback = (ev) => {
            const parsedData = JSON.parse(ev.data);

            if (parsedData.id === req.id) {
                resolve(parsedData);
                ws.removeEventListener("message", callback);
            }
        };
        ws.addEventListener("message", callback);
    });

    const subscribe = (req, callback) => {
        if (ws.readyState !== 1) {
            return false;
        }

        req.requestType = "Subscription";
        req.id = Math.round(Math.random() * Number.MAX_SAFE_INTEGER);
        ws.send(JSON.stringify(req));
        ws.addEventListener("message", (ev) => {
            const parsedData = JSON.parse(ev.data);

            if (parsedData.id === req.id) {
                callback(parsedData);
            }
        });
    };


    return {
        send,
        subscribe,
        ready: new Promise(resolve => {
            ws.onopen = resolve;
        })
    };
}

const ws = websocketConnection();
let rawUserData;
ws.ready.then(() => {
    const req = {
        commands: [
            {
                commandOptions: ["SendErrorMessage"],
                symbol: `${window.hmiCurrentDomain()}.Config::users`
            }
        ]
    };
    ws.subscribe(req, (res) => {
        if (res.error) {
            console.error(res.error);
            return;
        }

        rawUserData = res.commands[0].readValue;
        createUserList();
    });
});

/**
 * @param {HTMLElement} el
 */
function removeUser(el) { // eslint-disable-line no-unused-vars
    const userName = decodeURIComponent(el.parentElement.parentElement.parentElement.dataset.userName);

    if (!confirm(`Are you sure you want to delete ${userName}?`)) {
        return;
    }

    ws.send({
        commands: [
            {
                commandOptions: ["SendErrorMessage"],
                symbol: `${window.hmiCurrentDomain()}.RemoveUser`,
                writeValue: userName
            }
        ]
    }).then(res => {
        if (!res.error && !res.commands[0].error) {
            createUserList();
        }
    });
}

async function createUserList() {
    const ul = document.querySelector(".user-list");
    const ulRow = document.querySelector("#user-list-row-template");
    const ulRowContent = document.querySelector("#user-list-row-content-template");

    // Remove deleted users
    for (let el = ul.firstElementChild; el; el = el.nextElementSibling) {
        if (!(decodeURIComponent(el.dataset.userName) in rawUserData)) {
            el.remove();
        }
    }


    for (const user in rawUserData) {
        const oldRow = ul.querySelector(`div[data-user-name="${encodeURIComponent(user)}"]`);

        if (oldRow) {
            continue;
        }

        const newRow = ulRow.content.cloneNode(true);
        newRow.firstElementChild.dataset.userName = encodeURIComponent(user);

        const uName = newRow.querySelector(".user-list-row-name");
        const rightSpan = newRow.querySelector(".user-list-right");
        uName.innerText = user;

        const userEdit = rightSpan.querySelector(".user-list-edit");
        const rowDiv = newRow.firstElementChild;
        userEdit.addEventListener("click", () => {
            if (rowDiv.childElementCount < 2) {
                const newRowContent = ulRowContent.content.cloneNode(true);
                const rfidCardUIDInput = newRowContent.querySelector("input[name=rfidCardUID");
                rfidCardUIDInput.addEventListener("input", () => {
                    if (rfidCardUIDInput.value !== rawUserData[user].rfidCardUID) {
                        rfidCardUIDInput.classList.add("input-text-changed");
                    } else {
                        rfidCardUIDInput.classList.remove("input-text-changed");
                    }
                });
                rfidCardUIDInput.value = rawUserData[user].rfidCardUID;

                const applyBtn = newRowContent.querySelector("input[type=button]");
                applyBtn.addEventListener("click", () => {
                    ws.send({
                        commands: [
                            {
                                commandOptions: ["SendErrorMessage"],
                                symbol: `${window.hmiCurrentDomain()}.Config::users::${user}::rfidCardUID`,
                                writeValue: rfidCardUIDInput.value
                            }
                        ]
                    }).then(res => {
                        if (res.error) {
                            alert(`${res.error.message}: ${res.error.reason}`);
                            return;
                        }

                        rfidCardUIDInput.classList.remove("input-text-changed");
                        rawUserData[user].rfidCardUID = rfidCardUIDInput.value;
                    });
                });

                rowDiv.appendChild(newRowContent.firstElementChild);
            } else if (rowDiv.lastElementChild.style.display !== "none") {
                rowDiv.lastElementChild.style.display = "none";
            } else {
                rowDiv.lastElementChild.style.display = null;
            }
        });

        ul.appendChild(newRow);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const readRfidCardUidBtn = document.querySelector("#read-rfid-card-uid-button");

    function addUiClientCallback() {
        readRfidCardUidBtn.addEventListener("click", async() => {
            try {
                const res = await tcuiclient.postMessage("RFID.getCurrentUid");
                const readRfidCardUidInput = document.querySelector("#read-rfid-card-uid-input");
                readRfidCardUidInput.value = res.uid;
            } catch (error) {
                alert(typeof error === "object"
                    ? `${error.message}: ${error.details}`
                    : error);
            }
        });

        readRfidCardUidBtn.title = null;
        readRfidCardUidBtn.readOnly = null;
    }

    if (window.tcuiclient) {
        addUiClientCallback();
    } else {
        window.addEventListener(
            "tcuiclientready",
            addUiClientCallback,
            { once: true }
        );
    }

    const addUserForm = document.querySelector("#add-user-form");
    addUserForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const userName = addUserForm.querySelector("#add-user-username").value;
        const rfidCardUid = addUserForm.querySelector("#add-user-uid").value;

        ws.send({
            commands: [
                {
                    commandOptions: ["SendErrorMessage"],
                    symbol: `${window.hmiCurrentDomain()}.AddUser`,
                    writeValue: {
                        userName,
                        password: rfidCardUid
                    }
                }
            ]
        }).then(res => {
            if (!res.error) {
                addUserForm.reset();
            } else {
                console.error(res.error);
            }
        });
    });
}, { once: true });
