//  This line provides intellisense for the tcuiclient API
// / <reference path="./node_modules/tc-ui-client-ext/renderer.d.ts" />

function performLogin(username, password) {
    // Establish a WebSocket connection to the TwinCAT HMI Server to send the login command.
    // The 'hmiWsEndpoint' method is provided by the TwinCAT HMI Server and returns the WebSocket endpoint.
    if (!window.hmiWsEndpoint) {
        return;
    }

    const webSocket = new WebSocket(window.hmiWsEndpoint());
    webSocket.onopen = () => {
        webSocket.send(JSON.stringify({
            commandOptions: ["SendErrorMessage"],
            commands: [
                {
                    symbol: "Login",
                    args: {
                        userName: username,
                        password
                    }
                }
            ]
        }));
    };

    // Once the TwinCAT HMI Server responds, the proper session cookie is created and the page is reloaded
    webSocket.onmessage = event => {
        const data = JSON.parse(event.data);
        if (!data.error && !data.commands[0]?.error) {
            document.cookie = `sessionId-${data.serverId}=${data.sessionId}; path=/`;
            const urlSearchParams = new URLSearchParams(window.location.search);

            if (urlSearchParams.has("Location")) {
                window.location.href = urlSearchParams.get("Location");
            } else {
                window.location.reload();
            }
        } else if (data.error) {
            const errorMessage = `${window.Localizations?.LoginFailed ?? `${data.error?.message}:`}<br>${data.error?.reason}`;
            let errorParagraph = document.querySelector("#auto-login-error-p");

            if (errorParagraph) {
                // If the error container already exists, display the new error message
                errorParagraph.innerHTML = errorMessage;
            } else {
                // Create new error container and show the error message
                const loginContainer = document.querySelector(".login-container");
                errorParagraph = document.createElement("p");
                errorParagraph.id = "auto-login-error-p";
                errorParagraph.classList.add("message", "error");
                errorParagraph.innerHTML = errorMessage;
                loginContainer?.prepend(errorParagraph);
            }
        }
    };
}

// Register a listener for the login event sent by the extension
tcuiclient.on(`${__extensionName}.login`, result => {
    performLogin(result.username, result.password);
});

// Register a listener for the logout event sent by the extension
tcuiclient.on(`${__extensionName}.logout`, () => {
    // Use the GET method to log out
    document.location = "/Logout";
});

// This function will be called when the extension is ready.
// It is used to perform the auto-login and to report the login status to the extension.
function onExtensionReady() {
    // Query the extension to see if the auto-login feature is enabled and not yet performed
    tcuiclient.postMessage(`${__extensionName}.autoLoginNecessary`).then(result => {
        if (result.autoLogin) {
            performLogin(result.autoLoginUsername, result.autoLoginPassword);
        }
    });

    // The '<html>' element will have the class 'tchmi-html-runtime' only when the user is logged in
    const onLoginPage = !document.documentElement.classList.contains("tchmi-html-runtime");
    tcuiclient.postMessage(`${__extensionName}.setLoginStatus`, onLoginPage);
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
