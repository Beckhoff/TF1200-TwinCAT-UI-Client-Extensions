# **TF1200** TwinCAT UI Client Extensions

Extensions in the TwinCAT UI Client provide additional functionality and enable
the execution of JavaScript code in a *Node.JS* environment. This allows web
applications to go beyond the limitations of a browser and leverage the power
of *Node.JS*. With *Node.JS*, you can accomplish tasks that would be difficult
or impossible using only browser APIs.

## Process Model

The TwinCAT UI Client operates in two separate environments:

- The **renderer process** loads the web page and executes JavaScript code on
the browser level.
- The **extension process** runs in a *Node.JS* environment and is isolated
from the browser window and web page.

These two processes can communicate with each other using the
[class `TcUiClientExt`](Extensions/ApiReference.md#class-tcuiclientext). The
renderer process is capable of sending messages to the extension process, while
the extension process can emit events that can be listened for in the renderer
process.

## Writing Extensions

### Create the Configuration File

To create an extension, first create a new directory and a
*EXTENSION.Config.json* file, where *EXTENSION* is the name of your
extension. Add the following required properties to this configuration file:

- `"name"`: name of your extension
- `"version"`: start with `"1.0.0"`
- `"entryPoint"`: name of the main JavaScript file (don't forget to create the
  main JavaScript file as well)

Here is an example configuration file:

```json
{
    "name": "MyExtension",
    "version": "1.0.0",
    "entryPoint": "index.js"
}
```

A configuration file can have further properties. Refer to the
[structure of the configuration file](Extensions/ApiReference.md#structure-of-the-configuration-file)
for more information.

### Install the npm Package

Install the npm package *@beckhoff/tc-ui-client-ext*:

```bash
npm install @beckhoff/tc-ui-client-ext
```

This will create the files *package.json* and *package-lock.json* as well as
the directory *node_modules*.

### Add the Extension

In order for the TwinCAT UI Client to load your extension, you have to point it
to your extension directory. Create an object in the `"extensions"` property in
the configuration file of the TwinCAT UI Client as follows:

```json
"extensions": {
    "my-extension": {
        "name": "MyExtension",
        "directory": "path/to/your/extension/",
        "version": "^1.0.0",
    }
}
```

Refer to the TwinCAT UI Client documentation for more information about
specifying extensions in the configuration file of the TwinCAT UI Client.

### Extension Code

With the npm package *@beckhoff/tc-ui-client-ext* installed and your extension
linked to the TwinCAT UI Client, you can write your application code in the
*index.js* file, which is normally the main entry point of your extension.
Start by importing the installed npm package and creating a class derived from
it:

```js
const { TcUiClientExt } = require("@beckhoff/tc-ui-client-ext");

class MyExtension extends TcUiClientExt {
    onMessage(command, args) {
        /* handle messages */
    }
}

module.exports = MyExtension;
```

To receive messages from the renderer process, your extension must implement
the abstract method
[`TcUiClientExt.onMessage`](Extensions/ApiReference.md#tcuiclientextonmessagecommand-args).
Other [abstract methods](Extensions/ApiReference.md#abstract-methods) are also
available.

### Renderer code

An extension can execute JavaScript code in the renderer process. To specify
JavaScript files to be executed in the renderer process, you can add them to
the configuration file of the extension as follows:

```json
"rendererScript": "renderer.js"
```

OR

```json
"rendererScript": [
    "dependency1.js",
    "dependency2.js",
    "renderer.js"
]
```

If you specify multiple JavaScript files in the `"rendererScript"` property of
the configuration file, they will be executed sequentially. This means that
*dependency2.js* can reference global variables declared in *dependency1.js*
using the `var` keyword, and *renderer.js* can reference both dependencies.

In the renderer scripts, you can utilize the
[namespace `tcuiclient`](Extensions/ApiReference.md#namespace-tcuiclient). The
methods from this namespace allow you to send messages to the extension process
and register event listeners. When using them, remember to prefix events and
messages with the name of your extension. To reference it in renderer scripts,
you can use the
[`__extensionName`](Extensions/ApiReference.md#variable-__extensionname)
constant, as the name is defined at runtime.

Before a renderer script can send messages to an extension, you need to ensure
that the extension is ready to receive messages. To do this, the extension must
be in the state `"ready"`. To execute code once the extension has reached this
state, you can use the following code:

```js
function onExtensionReady() {
    /* code to be executed once the extension is ready */
}

tcuiclient.postMessage("System.extensions").then(extensions => {
    if (extensions[__extensionName] === "ready") {
        onExtensionReady();
    } else {
        tcuiclient.on(__extensionName + ".ready", onExtensionReady);
    }
});
```

Event listeners can be registered at any time.

## Debugging an Extension

To debug your code when developing an extension, you need to configure the
TwinCAT UI Client to load your extension at startup by adding the property
`"debugPort"` to the `"extensions"` object. The extension is then started in
debugging mode so that you can connect a debugger. If you encounter issues
connecting the debugger to the extension, try using a different port as the
current one may be busy. Here is an example for an `"extensions"` object:

```json
"extensions": {
    "my-extension": {
        "name": "MyExtension",
        "directory": "path/to/your/extension/",
        "version": "^1.0.0",
        "debugPort": 1234
    }
}
```

To debug the extension, you can attach any *Node.JS* debugger to it. The
extension will wait for a debugger to be attached before executing the
extension code.

If you want to debug a renderer script, you can open the *DevTools* in the
TwinCAT UI Client. In the console, you'll see log messages from each of your
renderer scripts. Click on the source of the message on the right to open the
script (e.g. `VM46:3`). Here, you can set breakpoints and inspect variables.
Note that the `debugger;` statement will be ignored. To open the *DevTools*
automatically at startup, you can set the following property in the
configuration file of the TwinCAT UI Client:

```json
"openDevTools": true
```

### Debugging with Visual Studio Code

To debug your extension using Visual Studio Code, you can add a launch
configuration to the *.vscode/launch.json* file. Ensure that the port specified
in the launch configuration matches the previously specified debug port:

```json
"configurations": [
    {
        "type": "node",
        "request": "attach",
        "name": "Attach to my extension",
        "port": 1234,
        "address": "localhost",
        "preLaunchTask": "Start TcUiClient",
        "postDebugTask": "Stop TcUiClient"
    }
]
```

The launch configuration contains references to `preLaunchTask` and
`postDebugTask`. These tasks are used to start the TwinCAT UI Client before you
can start debugging and stop it afterwards. To set up these tasks, you need to
define two new tasks in the *.vscode/tasks.json* file as follows:

```json
"tasks": [
    {
        "label": "Start TcUiClient",
        "type": "shell",
        "command": "/usr/local/etc/TwinCAT/Functions/TF1200-UI-Client/TF1200-UI-Client &",
        "windows": {
            "command": "Start-Process \"C:\\Program Files (x86)\\Beckhoff\\TcUiClient\\TF1200-UI-Client.exe\"",
            "options": {
                "shell": {
                    "executable": "powershell.exe"
                }
            }
        }
    },
    {
        "label": "Stop TcUiClient",
        "type": "shell",
        "command": "echo \"Task not implemented\"",
        "windows": {
            "command": "Get-Process TF1200-UI-Client -ErrorAction SilentlyContinue | ForEach-Object { $_.CloseMainWindow() | Out-Null }",
            "options": {
                "shell": {
                    "executable": "powershell.exe"
                }
            }
        }
    }
]
```

Make sure to replace the path to the *TF1200-UI-Client[.exe]* to match your
installation directory.

Refer to the following articles for assistance if you encounter any issues with
launch configurations or tasks:

- [Launch configurations](https://go.microsoft.com/fwlink/?linkid=830387)
- [Integrate with External Tools via Tasks](https://go.microsoft.com/fwlink/?LinkId=733558)
