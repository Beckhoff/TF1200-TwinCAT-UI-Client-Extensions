# TwinCAT HMI project

This sample demonstrates the usage of the `tcuiclient` API in a TwinCAT HMI
project. The project is configured to send data to the extension when a button
is clicked. Event listeners are also registered. This sample utilizes
[Code-Behind](https://infosys.beckhoff.com/content/1031/te2000_tc3_hmi_engineering/4872803723.html)
files in the TwinCAT HMI project,
[Functions](https://infosys.beckhoff.com/content/1031/te2000_tc3_hmi_engineering/4872801803.html?id=7875180467472529340)
and the
[Framework API](https://infosys.beckhoff.com/content/1031/te2000_tc3_hmi_engineering/3730606987.html?id=1426887615595781518).

> When adding the extension to the configuration of the TwinCAT UI Client,
  ensure that it's named *HmiProject* or make the necessary adjustments to the
  references in the TwinCAT HMI project.

There are two subdirectories in this extension directory:

- The directory *./HmiProject* contains a TwinCAT HMI project which is
configured to interface with the `tcuiclient` API.
- The directory *./TcUiClientExtension* contains the *HmiProject* extension for
  the TwinCAT UI Client. The extension consists of a minimal configuration file
  and an *index.js* file with the application code. The extension will respond
  to two commands:
  - `HmiProject.increment`\
    When this command is sent, the `args` parameter is interpreted as an
    integer and incremented by one. The result is returned.
  - `HmiProject.triggerEvent`\
    When this command is sent, the event `HmiProject.eventTriggered` is
    triggered one second later. The current time is sent as the `result`.

These messages and events are used in the TwinCAT HMI project. Here, a new
[Function](https://infosys.beckhoff.com/content/1031/te2000_tc3_hmi_engineering/4872801803.html?id=7875180467472529340)
called `Increment` is created in the file
[IncrementFunction.js](HmiProject/IncrementFunction.js). In the function, a
message with the `increment` command and a number is sent to the extension. The
result is written to a
[TcHmiNumericInput](https://infosys.beckhoff.com/content/1031/te2000_tc3_hmi_engineering/10229192203.html?id=5864314985438090980)
control:

```js
 function Increment(inValue, outControlId) {
     /* Send the 'increment' message to the TwinCAT UI Client extension */
     tcuiclient.postMessage("HmiProject.increment", inValue).then((result) => {
         /* get the Framework control to write the result value to */
         const outControl = TcHmi.Controls.get(outControlId);
         /* write the result value to the control */
         outControl.setValue(result.value);
     });
 }
```

This function is registered for the `onPressed` event of the `IncrementBtn`
button in the file [Desktop.view](HmiProject/Desktop.view). When the button is
pressed, the `Increment` function is called with the value and id of the
`TcHmiNumericInput` control. As a result, the number in the `TcHmiNumericInput`
contorl is incremented by one each time the button is pressed.

When the `TriggerEventBtn` button is pressed, the `triggerEvent` message is
sent to the TwinCAT UI Client extension. The event sent by the extension one
second later is listened for. To achieve this, the *Code-Behind* file
[EventListenerCodeBehind.js](HmiProject/EventListenerCodeBehind.js) is used.
First, a promise is created which resolves once the `tcuiclient` API is
available:

```js
/* This promise will resolve once the tcuiclient API is available */
const tcuiclientready = new Promise((resolve) => {
    if (window.tcuiclient) {
        resolve();
    } else {
        window.addEventListener("tcuiclientready", resolve());
    }
});
```

After the TwinCAT HMI Framework has finished loading, the reference to the
`Textblock` where the results are written is obtained. Then, a listener for the
event `HmiProject.eventTriggered` is registered. When the event occurs, a
message with the `result` of the event will be prepended to the text of the
`Textblock`. Therefore, one second after the button is pressed, a message with
the current time will appear in the `Textblock`:

```js
const eventResultTextblock = TcHmi.Controls.get("EventResultTextblock");

tcuiclientready.then(() => {
    tcuiclient.on("HmiProject.eventTriggered", (currentTime) => {
        const currentTextblockText = eventResultTextblock.getText();
        eventResultTextblock.setText(`Event received successfully at ${currentTime}\n${currentTextblockText}`);
    });
});
```
