/* eslint-disable-next-line @typescript-eslint/triple-slash-reference */
/// <reference path="../../node_modules/@beckhoff/tc-ui-client-ext/renderer.d.ts" />

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
declare interface Window {
    /** The `hmiWsEndpoint()` function is provided by the HMI server and returns the WebSocket endpoint. */
    hmiWsEndpoint?(): string;
    /** The `Localizations` object contains localized strings */
    Localizations?: { LoginFailed?: string }
}

function performLogin(username: string, password: string): void {
    // Establish a WebSocket connection to the HMI server to send the login command.
    if (!window.hmiWsEndpoint) return;
    const webSocket = new WebSocket(window.hmiWsEndpoint());
    webSocket.onopen = () => {
        webSocket.send(JSON.stringify({
            commandOptions: ["SendErrorMessage"],
            commands: [
                {
                    symbol: "Login",
                    writeValue: {
                        userName: username,
                        password: password
                    }
                }
            ]
        }));
    };
    // Once the HMI server responds, the proper session cookie is created
    // and the page is reloaded.
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
            // Create error container and show the error message
            const loginContainer = document.querySelector(".login-container");
            const errorParagraph = document.createElement("p");
            errorParagraph.classList.add("message", "error");
            errorParagraph.innerText = `${window.Localizations?.LoginFailed ?? data.error?.message + ":"} ${data.error?.reason}`;
            loginContainer?.prepend(errorParagraph);
        }
    };
}

tcuiclient.on(__extensionName + ".login", args => {
    // Send the login request to the custom authentication extension in the server.
    performLogin(`${args.domain}::_`, args.uid);
});

tcuiclient.on(__extensionName + ".logout", () => {
    window.location.href = "/Logout";
});

tcuiclient.on(__extensionName + ".gotoUserConfiguration", domain => {
    // Navigate to the user configuration page of the server extension
    window.location.href = `/Config/Extensions/${domain}?Content=%5F%5FCUSTOM%5FCONFIG%5F%5F`;
});
