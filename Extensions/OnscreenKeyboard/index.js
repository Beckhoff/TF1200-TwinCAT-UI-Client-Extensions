const { TcUiClientExt } = require("@beckhoff/tc-ui-client-ext");
const child_process = require("child_process");
const process = require("process");

class OnScreenKeyboard extends TcUiClientExt {
    #openOnscreenKeyboard() {
        // Check if on-screen keyboard is already running
        try {
            if (process.platform === "win32") {
                let result = child_process.execSync(
                    "(Get-Process osk).Id",
                    { shell: "powershell.exe", encoding: "utf8" }
                );

                if (result) {
                    return {
                        error: {
                            message: `The on-screen keyboard is already running with process ID ${result.trimEnd()}`
                        }
                    };
                }
            } else {
                let result = child_process.execSync(
                    `pgrep ${this.command} || true`,
                    { shell: "/bin/sh", encoding: "utf8" }
                );

                if (result) {
                    // The keyboard can be hidden by sending it a SIGUSR1
                    // signal, shown again by sending it SIGUSR2 or toggled by
                    // sending it SIGRTMIN. This saves some start up time and
                    // may be appropriate in some low-resource environments.
                    child_process.execSync(
                        `pkill -SIGUSR2 ${this.command}`,
                        { shell: "/bin/sh", encoding: "utf8" }
                    );

                    return { success: true };
                }
            }
        } catch (error) {
            return {
                error: {
                    message: "There was an error while opening the on-screen keyboard",
                    details: error.message
                }
            };
        }

        let onscreenKeyboardConsoleProcess = null;

        if (process.platform === "win32") {
            // The process is spawned with '{ shell: true }', because it's not allowed to start osk.exe directly
            onscreenKeyboardConsoleProcess = child_process.spawn(
                "osk",
                {
                    shell: true
                }
            );
        } else {
            onscreenKeyboardConsoleProcess = child_process.spawn(this.command, this.arguments);
        }

        return new Promise(resolve => {
            onscreenKeyboardConsoleProcess.once("error", (err) => {
                resolve({
                    error: {
                        message: "There was an error while opening the on-screen keyboard",
                        details: err.message
                    }
                });
            });

            onscreenKeyboardConsoleProcess.once("spawn", () => {
                resolve({ success: true });
            });
        });
    }

    #closeOnscreenKeyboard() {
        try {
            if (process.platform === "win32") {
                this.removeOnscreenKeyboard();
            } else {
                child_process.execSync(
                    `pkill -SIGUSR1 ${this.command}`,
                    { shell: "/bin/sh", encoding: "utf8" }
                );
            }

            return { success: true };
        } catch (err) {
            return {
                error: {
                    message: "There was an error while terminating the on-screen keyboard process",
                    details: err.message
                }
            };
        }
    }

    removeOnscreenKeyboard() {
        // Try to kill the process osk.exe with CIM
        // The taskkill command cannot be used as it requires elevated permissions
        child_process.execSync(
            "Get-CimInstance -Class Win32_Process -Filter \"Name = 'osk.exe'\" | Remove-CimInstance",
            { shell: "powershell.exe", encoding: "utf8" }
        );
    }

    // This method is called when the extension is started
    onStartup(options) {
        if (process.platform !== "win32") {
            if (options) {
                if ("command" in options && typeof options["command"] == "string") {
                    this.command = options["command"]
                }

                if ("arguments" in options && Array.isArray(options["arguments"])) {
                    this.arguments = options["arguments"]
                }
            }

            if (!(this.command)) {
                this.command = "wvkbd-mobintl"
            }

            if (!(this.arguments)) {
                this.arguments = []
            }
        }
    }

    onMessage(command) {
        switch (command) {
            case "openOnscreenKeyboard":
                return this.#openOnscreenKeyboard();

            case "closeOnscreenKeyboard":
                return this.#closeOnscreenKeyboard();

            default:
                return { error: `Command '${command}' is not supported` };
        }
    }

    onShutdown() {
        try {
            if (process.platform === "win32") {
                this.removeOnscreenKeyboard();
            } else {
                child_process.execSync(
                    `pkill ${this.command}`,
                    { shell: "/bin/sh", encoding: "utf8" }
                );
            }
        } catch { }
    }
}

module.exports = OnScreenKeyboard;
