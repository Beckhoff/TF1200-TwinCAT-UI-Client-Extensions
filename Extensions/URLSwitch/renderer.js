//  This line provides intellisense for the tcuiclient API
// / <reference path="./node_modules/tc-ui-client-ext/renderer.d.ts" />

// This function will be called when the extension is ready.
// It is used to switch between two URLs every 10 seconds.
// You should implement a more suitable custom logic here to switch to another URL.
function onExtensionReady() {
    setInterval(() => {
        window.location.href = window.location.href === "https://www.beckhoff.com/en-us/products/automation/twincat/tfxxxx-twincat-3-functions/tf1xxx-system/tf1200.html"
            ? "https://www.beckhoff.com/en-us/products/automation/twincat/tfxxxx-twincat-3-functions/tf2xxx-hmi/tf2000.html"
            : "https://www.beckhoff.com/en-us/products/automation/twincat/tfxxxx-twincat-3-functions/tf1xxx-system/tf1200.html";
    }, 10000);
}

// Check if the extension is ready to receive messages. The 'System.extensions' command contains the states of all
// extensions. If the extension is already in the 'ready' state, the 'onExtensionReady' function is called immediately.
// Otherwise, a listener for the 'ready' event is registered with the 'onExtensionReady' function as the callback.
tcuiclient.postMessage("System.extensions").then(extensions => {
    if (extensions[__extensionName] === "ready") {
        onExtensionReady();
    } else {
        tcuiclient.once(`${__extensionName}.ready`, onExtensionReady);
    }
});
