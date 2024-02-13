const { TcUiClientExt } = require("@beckhoff/tc-ui-client-ext");

class HmiProject extends TcUiClientExt {
    onMessage(command, args) {
        switch (command) {
            case "increment":
                {
                    const numberValue = parseInt(args, 10);
                    return { value: numberValue + 1 };
                }

            case "triggerEvent":
                setTimeout(() => {
                    this.emit("eventTriggered", new Date().toLocaleTimeString());
                }, 1000);
                return { success: true };

            default:
                return { error: `Command '${command}' is not supported` };
        }
    }
}

module.exports = HmiProject;
