# Logging

This extension enables logging of messages from the renderer process to a
simple text file. It consists of the minimal configuration file
*Logging.Config.json*, and the extension code in *index.js*.

## Step-by-step explanation

This section provides a detailed explanation of each component of the
extension. Let's begin with the *Logging.Config.json* file, which contains
information about the extension used by the TwinCAT UI Client to start it.

```json
{
    "name": "Logging",
    "version": "1.0.0",
    "description": "This extension logs simple messages to a text file.",
    "entryPoint": "index.js"
}
```

Every extension must have a `name` and a `version` property to uniquely
identify it. The `description` property provides a brief explanation of the
functionality of the extension, although it is optional. The `entryPoint`
property is required and specifies the path to the extension code.

### Extension code

A TwinCAT UI Client extension is a JavaScript class that inherits from an
abstract base class provided by the `@beckhoff/tc-ui-client-ext` package. This
base class defines certain methods that the extension can implement.

In the file *index.js*, the `Logging` class is created after importing the
`@beckhoff/tc-ui-client-ext` module and some *Node.JS* modules.

```js
const { TcUiClientExt } = require("@beckhoff/tc-ui-client-ext");
const fs = require("fs");
const path = require("path");

class Logging extends TcUiClientExt {
    /* extension code */
}
```

There are three methods that an extension can implement to handle specific
events:

- The first method is `onStartup`, which is called when the TwinCAT UI Client
  is started and the extensions are loaded. In the case of the *Logging*
  extension, this method creates a file handle for the log file and saves it as
  a class member. Additionally, a log message is written to the log file using
  the `#log` method, which is defined earlier and writes a log message to
  `this.logFile`:

  ```js
  onStartup() {
      const logFilePath = path.join(__dirname, "example.log");
      this.logFile = fs.openSync(logFilePath, "a");
      this.#log("Logging extension started.");
  }
  ```

- An extension can receive messages from the renderer process. When a message
  is sent to the extension, the `onMessage` method is called with the parameters
  `command` and `args`. The `command` parameter is a string that identifies the
  message, while `args` is a JavaScript value that contains the data sent with
  the event. To handle different commands, a `switch/case` statement is used in
  the `onMessage` method. In this case, only the `log` command is expected. The
  code executed when the `log` message is sent is separated into an own method
  for better readability.

  It is important to include a default case to handle unsupported commands sent
  to the extension. The return value of the `onMessage` method is sent as a
  response to the message. If an error occurs, an object with the `error`
  property is returned, which rejects the promise waiting for a response in the
  renderer:

  ```js
  onMessage(command, args) {
      switch (command) {
          case "log":
              return this.#logMessage(args);

          default:
              return { error: `Command '${command}' is not supported` };
      }
  }
  ```

- When the TwinCAT UI Client is shutting down, the `onShutdown` method is
  called. This method is responsible for performing all necessary cleanup tasks
  before the extension process is terminated. In this case, a final log message
  is written and the file handle is closed:

  ```js
  onShutdown() {
      this.#log("Logging extension stopped.");
      fs.closeSync(this.logFile);
  }
  ```

Finally, the extension class is exported from the module so the TwinCAT UI
Client can import and instantiate it:

```js
module.exports = Logging;
```

### Other files

The extension directory also includes a *package.json* file where additional
dependencies can be specified. The `@beckhoff/tc-ui-client-ext` package is
always required.
