// Keep these lines for a best effort IntelliSense of Visual Studio 2017 and higher.
/// <reference path="Packages/Beckhoff.TwinCAT.HMI.Framework.14.0.208/runtimes/native1.12-tchmi/TcHmi.d.ts" />
/// <reference path="../TcUiClientExtension/node_modules/@beckhoff/tc-ui-client-ext/renderer.d.ts" />

(function (/** @type {globalThis.TcHmi} */ TcHmi) {
    var Functions;
    (function (/** @type {globalThis.TcHmi.Functions} */ Functions) {
        var HmiProject;
        (function (HmiProject) {
            function Increment(inValue, outControlId) {
                /* Send the 'increment' message to the TwinCAT UI Client extension */
                tcuiclient.postMessage("HmiProject.increment", inValue).then((result) => {
                    /* get the Framework control to write the result value to */
                    const outControl = TcHmi.Controls.get(outControlId);
                    /* write the result value to the control */
                    outControl.setValue(result.value);
                });
            }
            HmiProject.Increment = Increment;
        })(HmiProject = Functions.HmiProject || (Functions.HmiProject = {}));
    })(Functions = TcHmi.Functions || (TcHmi.Functions = {}));
})(TcHmi);
TcHmi.Functions.registerFunctionEx('Increment', 'TcHmi.Functions.HmiProject', TcHmi.Functions.HmiProject.Increment);
