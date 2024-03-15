// This script is used to display an error box in the TwinCAT UI Client when
// the connection with the RFID reader is lost or could not be established

tcuiclient.on(__extensionName + ".showDeviceError", err => {
    // Insert a style tag into the document's <head>
    if (!document.head.querySelector("#rfid-auth-device-error-style")) {
        const style = document.createElement("style");
        style.id = "rfid-auth-device-error-style";
        style.innerHTML = `#device-error-wrapper {
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: sans-serif;
            position: absolute;
            top: 0;
            left: 0;
            background-color: rgba(0, 0, 0, 0.3)
        }

        #device-error-container {
            width: 350px;
            background-color: white;
            display: flex;
            justify-content: center;
            padding: 20px;
            flex-direction: column;
            box-shadow: 0 0 10px 1px white;
        }

        @media (prefers-color-scheme: dark){
            #device-error-container{
                color: white;
                background-color: #252526;
            }
        }`;
        document.head.append(style);
    }

    // Display a message box in the center of the screen and dimm the rest
    if (!document.body.querySelector("#device-error-wrapper")) {
        const div = document.createElement("div");
        div.innerHTML = `
        <div id="device-error-wrapper">
            <div id="device-error-container">
                <h1>${__extensionName}: Device connection is not possible</h1>
                <br>
                <p>The connection to the device at COM${err.comPort} has been lost or could not be established. Make sure the
                    correct COM port is selected.
                    Try to select the correct COM port from the application menu again. If the problem persists, try restarting
                    the TwinCAT UI Client</p>
                <span>
                    <label for="device-error-do-not-show-again-checkbox">Do not show again</label>
                    <input type="checkbox" id="device-error-do-not-show-again-checkbox" />
                </span> <br>
                <input type="button" id="device-error-ok" value="Ok" style="width:100%; margin-bottom: 5px">
            </div>
        </div>
        `;
        const doNotShowAgainCheckbox = div.querySelector("#device-error-do-not-show-again-checkbox") as HTMLInputElement;
        const okBtn = div.querySelector("#device-error-ok");
        okBtn.addEventListener("click", () => {
            // Acknowledge the error
            tcuiclient.postMessage(__extensionName + ".acknowledgeDeviceError", {
                doNotShowAgain: doNotShowAgainCheckbox.checked
            });
            document.body.querySelector("#device-error-wrapper")?.remove();
        });
        document.body.append(div.firstElementChild);
    }
});

function onExtensionReady() {
    // Asks the extension to send non acknowledged errors again (e.g. after a page reload)
    tcuiclient.postMessage(__extensionName + ".getNonAcknowledgedDeviceError");
}

tcuiclient.postMessage("System.extensions").then(extensions => {
    if (extensions[__extensionName] === "ready") {
        onExtensionReady();
    } else {
        tcuiclient.once(__extensionName + ".ready", onExtensionReady);
    }
});
