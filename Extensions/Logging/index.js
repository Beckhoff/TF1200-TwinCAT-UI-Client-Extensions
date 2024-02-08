const { TcUiClientExt } = require("@beckhoff/tc-ui-client-ext");
const fs = require("fs");
const path = require("path");

class Logging extends TcUiClientExt {
    #log(message, level = "INFO", timestamp = new Date().toISOString()) {
        const logMessage = `${timestamp} [${level}] ${message}\n`;
        fs.writeFileSync(this.logFile, logMessage);
    }

    #logMessage(args) {
        const { message, level, timestamp } = args;

        try {
            this.#log(message, level, timestamp);
            return { success: true };
        } catch (err) {
            return { error: err };
        }
    }

    // This method is called when the extension is started
    onStartup() {
        const logFilePath = path.join(__dirname, "example.log");
        this.logFile = fs.openSync(logFilePath, "a");
        this.#log("Logging extension started.");
    }

    // This method is called when the extension receives a message from the renderer
    onMessage(command, args) {
        switch (command) {
            case "log":
                return this.#logMessage(args);

            default:
                return { error: `Command '${command}' is not supported` };
        }
    }

    // This method is called when the TwinCAT UI Client is shutting down
    onShutdown() {
        this.#log("Logging extension stopped.");
        fs.closeSync(this.logFile);
    }
}

module.exports = Logging;
