import { IDeviceConnection, ConnectionError } from "./RFIDCommunication";

export class RFIDLogic {
    currentUid: string = null;
    pollingInterval = 250; //ms
    /** A function that is executed when a `ConnectionError` occurs with the
     * RFID reader */
    onDeviceError: () => void = null;
    private updateHandlers: ((uid: string | null) => void)[] = [];
    private timeout: NodeJS.Timeout = null;
    private rfidCom: IDeviceConnection;

    /**
     * This function is called when a card is detected or removed
     */
    private invokeUpdateHandlers() {
        this.updateHandlers.forEach(func => func(this.currentUid));
    }

    private stopPolling(): void {
        if (!this.timeout) {
            return;
        }

        clearInterval(this.timeout);
        this.timeout = null;
    }

    /**
     * This function is called every 250ms
     */
    private pollReader() {
        // If the RFIDCommunication object is null, the polling is stopped
        // Try to read the serial number from the RFID reader
        try {
            const res = this.rfidCom.readSerialNumber();

            // A new card is detected
            if (res !== this.currentUid && typeof res === "string") {
                this.currentUid = res;
                this.invokeUpdateHandlers();
                // The current card is removed
            } else if (res === false && typeof this.currentUid === "string") {
                this.currentUid = null;
                this.invokeUpdateHandlers();
            }
        } catch (err) {
            // If a connection error occurs, the polling is stopped for
            // performance reasons
            if (err instanceof ConnectionError) {
                this.stopPolling();

                if (this.onDeviceError) {
                    this.onDeviceError();
                }

                return;
            }

            throw err;
        }
    }

    constructor(pRFIDCom: IDeviceConnection) {
        this.rfidCom = pRFIDCom;
    }

    /**
     * Adds an update handler to the list of update handlers
     */
    addUpdateHandler(func: (uid: string | null) => void) {
        this.updateHandlers.push(func);
    }

    /**
     * Opens a connection to the COM port and start polling the RFID reader for UIDs
     * @param comPort The number of the COM port to connect to
     */
    start(comPort: number): void {
        try {
            this.rfidCom.open(comPort);

            if (!this.timeout) {
                // The timeout needs to be unreferenced or it might block the
                // event loop when the program exits. The 'onShutdown' method
                // cannot be executed then.
                this.timeout = setInterval(this.pollReader.bind(this), this.pollingInterval).unref();
            }
        } catch (err: unknown) {
            if (err instanceof ConnectionError) {
                if (this.onDeviceError) {
                    this.onDeviceError();
                }

                return;
            }

            throw err;
        }
    }
}
