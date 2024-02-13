// Keep these lines for a best effort IntelliSense of Visual Studio 2017 and higher.
/// <reference path="Packages/Beckhoff.TwinCAT.HMI.Framework.14.0.208/runtimes/native1.12-tchmi/TcHmi.d.ts" />
/// <reference path="../TcUiClientExtension/node_modules/@beckhoff/tc-ui-client-ext/renderer.d.ts" />

(function (/** @type {globalThis.TcHmi} */ TcHmi) {

    /* This promise will resolve once the tcuiclient API is available */
    const tcuiclientready = new Promise((resolve) => {
        if (window.tcuiclient) {
            resolve();
        } else {
            window.addEventListener("tcuiclientready", resolve());
        }
    });

    let destroyOnInitialized = TcHmi.EventProvider.register('onInitialized', (e, data) => {
        e.destroy();

        /* Get the reference to the text block to write a message to */
        const eventResultTextblock = TcHmi.Controls.get("EventResultTextblock");

        /* wait for the tcuiclient API to be available before registering event handler */
        tcuiclientready.then(() => {
            /* register an event handler for the 'eventTriggered' event from the 'HmiProject' extension */
            tcuiclient.on("HmiProject.eventTriggered", (currentTime) => {
                /* get the text currently displayed in the text block */
                const currentTextblockText = eventResultTextblock.getText();
                /* write a message with the timestamp sent with the event to the text block */
                eventResultTextblock.setText(`Event received successfully at ${currentTime}\n${currentTextblockText}`);
            });
        });
    });
})(TcHmi);
