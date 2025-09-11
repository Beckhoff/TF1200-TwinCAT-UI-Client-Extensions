/* eslint-disable-next-line @typescript-eslint/triple-slash-reference */
/// <reference path="../../node_modules/@beckhoff/tc-ui-client-ext/renderer.d.ts" />
/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
declare interface Window {
    __localizations?: object[],
    Localizations?: string[]
}

(() => {
var hostBaseUri: string;
async function currentWebSocket(): Promise<string> {
    if (hostBaseUri === undefined) {
        hostBaseUri = (await fetch(window.location.href, { method: 'HEAD' })).headers.get('X-Custom-Reverse-Proxy-Host-Uri');
    }
    if (hostBaseUri) {
        return hostBaseUri.replace("https://", "wss://").replace("http://", "ws://");
    }
    if (window.location.protocol == "https:") {
        return "wss://" + window.location.host;
    }
    return "ws://" + window.location.host;
}

function getLocalization(localizationId: string): string | null {
    const localizationEntry = window.__localizations?.[localizationId];
    if (!localizationEntry) {
        return window.Localizations?.[localizationId];
    }
    let local = localizationEntry[navigator.language.split('-')[0]];
    if (!local) {
        local = localizationEntry['en'];
    }
    return local;
}

async function performLogin(username: string, password: string): Promise<void> {
    const webSocket = new WebSocket(await currentWebSocket());
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
            const loginContainer: HTMLElement | null = document.querySelector(".login-container");
            if (!loginContainer) return;

            // check message and build output string
            let errorMessage = getLocalization("LoginFailed") + "<br>";
            switch (data.error.message) {
                case "AUTH_FAILED":
                    errorMessage += getLocalization("InvalidUsernameOrPassword");
                    break;
                case "AUTH_WAIT":
                    errorMessage += getLocalization("TooManyFailedLoginAttempts");
                    break;
                default:
                    if (data.error.reason) errorMessage += ` ${data.error.reason}`;
            }

            // Create error container and show the error message
            let errorParagraph: HTMLParagraphElement | null = loginContainer?.querySelector("p.error");
            if (errorParagraph === null) {
                errorParagraph = document.createElement("p");
                errorParagraph.classList.add("message", "error");
                loginContainer?.prepend(errorParagraph);
            }
            errorParagraph.innerHTML = errorMessage;
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

})();