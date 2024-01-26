<!--markdownlint-disable no-inline-html -->
# API Reference for TwinCAT UI Client Extensions

## Table of contents

- [Structure of the Configuration File](#structure-of-the-configuration-file)
- [Class `TcUiClientExt`](#class-tcuiclientext)
  - [Abstract methods](#abstract-methods)
    - [`TcUiClientExt.onStartup()`](#tcuiclientextonstartup)
    - [`TcUiClientExt.onMessage(command, args)`](#tcuiclientextonmessagecommand-args)
    - [`TcUiClientExt.onShutdown()`](#tcuiclientextonshutdown)
  - [Instance methods](#instance-methods)
    - [`TcUiClientExt.emit(command, result)`](#tcuiclientextemitcommand-result)
    - [`TcUiClientExt.changeMenuItemProperty(id, properties)`](#tcuiclientextchangemenuitempropertyid-properties)
- [Namespace `tcuiclient`](#namespace-tcuiclient)
  - [Static methods](#static-methods)
    - [`tcuiclient.postMessage(command, args)`](#tcuiclientpostmessagecommand-args)
    - [`tcuiclient.on(event, callback)`](#tcuiclientonevent-callback)
    - [`tcuiclient.once(event, callback)`](#tcuiclientonceevent-callback)
    - [`tcuiclient.removeListenerById(event, callbackId)`](#tcuiclientremovelistenerbyidevent-callbackid)
- [Miscellaneous](#miscellaneous)
  - [Variable `__extensionName`](#variable-__extensionname)
  - [Event `window.tcuiclientready`](#event-windowtcuiclientready)

## Structure of the Configuration File

- `"name"` *(string)*: Display name of the extension
- `"version"` *(string)*: Version of the extension as a
  [semantic version range](https://semver.org)
- `"entryPoint"` *(string)*: Path to the JavaScript file containing the main
  entry point of the extension (can be an absolute path or a path relative to
  the extension root)
- `"description"` *(string)*: Description of the extension
- `rendererScript` *(string or array of strings)*: A path or an array of paths
  to a JavaScript file containing the code to be executed in the renderer
  process after the DOM has loaded and the *tcuiclient* namespace is available
  (can be absolute paths or paths relative to the extension root)
- `menuBar` *(array of objects)*: If specified, a
  [`MenuItem`](https://www.electronjs.org/de/docs/latest/api/menu-item) is
  created in the application menu for the extension. This array is passed to
  the `submenu` property of the `MenuItem` for the extension. The `click`
  property is the command of a message sent to the `onMessage` method when the
  `MenuItem` gets clicked.
  - Items *(object)*: Contains additional properties
    - <span id="menuBar-click">`click`</span> *(string)*: The command of the
      message to be send to the `onMessage` method of the extension
    - <span id="menuBar-id">`id`</span> *(string)*: The identifier of the
      `MenuItem` which must be unique for the extension. This identifier is
      used to change the properties of the `MenuItem` at runtime.
- `ignoreMultipleInstanceWarning` *(boolean)*: If set to `true`, the extension
  host won't show a warning if the user tries to start multiple instances of
  this extension. The default value is `false`.

## Class `TcUiClientExt`

The `TcUiClientExt` class is exposed by the `@beckhoff/tc-ui-client-ext` module:

```js
const { TcUiClientExt } = require("@beckhoff/tc-ui-client-ext");
```

This is an abstract class used as a base for deriving extensions.

---

### Abstract methods

These methods can be implemented by extensions and are called when certain
events occur.

#### `TcUiClientExt.onStartup()`

- Returns:  `<void>` | `<Promise<void>>`

This method is called when the extension is started. It may run asynchronously
or return a `Promise<void>`. When the `Promise<void>` is resolved, the
extension is considered started. If the `Promise<void>` is rejected, the
extension has failed to start and the corresponding error is logged.

> Don't try to use [`TcUiClientExt.emit`](#tcuiclientextemitcommand-result) to
  emit events that a renderer script should listen for. This won't always work
  as the [`TcUiClientExt.onStartup`](#tcuiclientextonstartup) method may be
  called before the renderer scripts start loading. In this instance, the event
  emitted won't be received by the renderer process.

#### `TcUiClientExt.onMessage(command, args)`

- `command`: `<string>`\
  The command of the message
- `args`: `<any>`\
  The value of the message
- Returns: `<void>` | `<Promise<void>>`\
  The value that gets passed to the renderer process as an answer

This method is called anytime the
[`tcuiclient.postMessage`](#tcuiclientpostmessagecommand-args) method is called
from the renderer process for the specified extension. It may run
asynchronously. Return a JavaScript object that will be passed to the renderer
process as an answer.

```js
onMessage(command, args) {
    switch(command) {
        case "supportedCommand":
            /* application logic */
            return { result: "Result" };

        default:
            return { error: "Command is not supported" };
    }
}
```

This method is also called, when a user clicks a `MenuItem` with a `click`
property. The `command` parameter is the `click` property of the `MenuItem`.
The `args` parameter has the properties `label` and `checked` which represents
the label of the `MenuItem` and the status of the checkbox respectively.

```js
onMessage(command, args) {
    // menu item with 'menuItemCallback' as the click property is clicked
    if (command === "menuItemCallback") {
        const { label, checked } = args;
        this.menuItemState[label] = checked;
    }
}
```

#### `TcUiClientExt.onShutdown()`

- Returns: `<void>`

This method is called when the extension process is shut down. It may only
contain synchronous code, as the event loop no longer runs after this method
returns.

---

### Instance methods

#### `TcUiClientExt.emit(command, result)`

- `command`: `<string>`\
  Name of the event
- `result`: `<any>`\
  Value to be passed to the callback

Sends an event to the renderer process. A callback for this event can be
registered with the [`tcuiclient.on`](#tcuiclientonevent-callback) method.

```js
/* extension code */
this.emit("commandName", { data: "Data" });

/* renderer process */
tcuiclient.on(__extensionName + ".commandName", (result) => {
    console.log(result.data);
});
```

#### `TcUiClientExt.changeMenuItemProperty(id, properties)`

- `id`: `<string>`\
  The [`id`](#menuBar-id) property of the `MenuItem`
- `properties`: `<Object>`\
  The properties to be changed

Modifies the properties of a `MenuItem`. The properties [`id`](#menuBar-id) and
[`click`](#menuBar-click) cannot be changed. If the `submenu` property is set,
new `MenuItem` instances are added to the submenu, but they cannot be removed
afterwards.

```js
// disable an element so it cannot be clicked
this.changeMenuItemProperty("conditionalElement", {
    enabled: false
});

// add a new MenuItem to a submenu
this.changeMenuItemProperty("dynamicSubmenu", {
    submenu: [
        {
            label: "entry1",
            id: "dynamicSubmenu-entry-1",
            click: "handleSubmenuClick"
        }
    ]
});
```

## Namespace `tcuiclient`

The `tcuiclient` namespace is available in renderer scripts. It's used to
communicate with the *Node.JS* part of the extension. Include a reference tag
in your script to get *IntelliSense* support.

```js
/// <reference path="node_modules/@beckhoff/tc-ui-client-ext/renderer.d.ts"/>
```

### Static Methods

#### `tcuiclient.postMessage(command, args)`

- `command`: `<string>`\
  A message identifier in the form `"extension.command"`
- `args`: `<any>`\
  A value passed to the
  [`TcUiClientExt.onMessage`](#tcuiclientextonmessagecommand-args) method of
  the extension
- Returns: `<Promise<any>>`\
  Resolves with the value returned by the
  [`TcUiClientExt.onMessage`](#tcuiclientextonmessagecommand-args) method of
  the extension

Sends a message to the extension specified in the `command` parameter. If the
`args` parameter is specified, the extension receives this value as a parameter
in the [`TcUiClientExt.onMessage`](#tcuiclientextonmessagecommand-args) method.
Returns a `<Promise<any>>`, that resolves with the value returned by the
[`TcUiClientExt.onMessage`](#tcuiclientextonmessagecommand-args) method of the
extension.

```js
tcuiclient.postMessage("exampleExtension.someCommand", { param1: true }).then( result => {
    console.log(result);
});
```

Querying the special command `"System.extensions"` yields an object that
returns the current states of all available extensions. An extension can be
in one of these four states:

- `"initializing"`\
  The extension has been started but has not yet completed the
  [`TcUiClientExt.onStartup`](#tcuiclientextonstartup) method. The extension
  cannot receive messages in this state.
- <span id="state-ready">`"ready"`</span>\
  The extension has been started and completed the
  [`TcUiClientExt.onStartup`](#tcuiclientextonstartup) method. The extension
  is ready to receive messages and can emit events.
- <span id="state-terminated">`"terminated"`</span>\
  The extension has exited. This may be the result of an uncaught exception.
  The extension cannot receive messages in this state.
- `undefined`\
  The extension state cannot be determined. This may be because the extension
  failed to start properly due to an invalid configuration.

```js
tcuiclient.postMessage("System.extensions").then((extensions) => {
    console.log(extensions);
    /* POSSIBLE OUTPUT:
        {
            extension1: "initializing",
            extension2: "ready",
            extension3: "terminated",
            extension4: undefined
        }
    */
});
```

#### `tcuiclient.on(event, callback)`

- `event`: `<string>`\
  Name of the event
- `callback`: `<Function>`\
  A callback function that takes the `result` sent by the
  [`TcUiClientExt.emit`](#tcuiclientextemitcommand-result) method as argument
- Returns: `<number>`\
  The id of the listener that can be used to remove the listener

Adds a callback function to the end of the listeners array for the specified
event. The listeners are invoked when the
[`TcUiClientExt.emit`](#tcuiclientextemitcommand-result) method is called by an
extension with the specified event name.

```js
tcuiclient.on("someExtension.sampleCommand", (result) => {
    console.log(result);
});
```

There are two special events emitted by an extension: The `.ready` event is
emitted when the state of the extension changes to [`"ready"`](#state-ready).
The `.exit` event is emitted when the extension terminates unexpectedly and
changes its state to [`"terminated"`](#state-terminated). The exit code of the
extension is provided as the result.

```js
tcuiclient.on("someExtension.ready", () => {
    console.log("Extension started");
});

tcuiclient.on("someExtension.exit", (exitCode) => {
    console.log(`Extension exited unexpectedly with code ${exitCode}`);
});
```

#### `tcuiclient.once(event, callback)`

- `event`: `<string>`\
  Name of the event
- `callback`: `<Function>`\
  A callback function that takes the `result` sent by the
  [`TcUiClientExt.emit`](#tcuiclientextemitcommand-result) method as argument
- Returns: `<number>`\
  The id of the listener that can be used to remove the listener

Adds a callback function to the end of the listeners array for the specified
event. The listener will be removed once it's invoked and will only be executed
once. For more information see [`tcuiclient.on`](#tcuiclientonevent-callback)
method.

#### `tcuiclient.removeListenerById(event, callbackId)`

- `event`: `<string>`\
  Name of the event
- `callbackId`: `<number>`\
  Id of the callback to remove
- Throws: `<Error>`\
  If no listeners for the specified event are registered or no listener with
  the specified id is registered for the event

Removes the listener with the specified id for the specified event.

```js
const callbackId = tcuiclient.on("sampleExtension.eventName", () => {
    console.log("An event was emitted").
});

tcuiclient.removeListenerById("sampleExtension.eventName", callbackId);
```

## Miscellaneous

### Variable `__extensionName`

A variable of type `<string>` that can be used to reference the current
extension name at runtime. This is only available in renderer scripts.

```js
tcuiclient.on(__extensionName + ".event", (data) => {
    console.log(data);
});
```

### Event `window.tcuiclientready`

An event that can be used to wait for the `tcuiclient` API to load if it's used
outside of extension renderer scripts.

```js
function ontcuiclientready() {
    tcuiclient.postMessage("System.extensions").then( extensions => {
        /* application code */
    });
}

if (!window.tcuiclient) {
    window.addEventListener("tcuiclientready", ontcuiclientready);
} else {
    ontcuiclientready();
}
```
