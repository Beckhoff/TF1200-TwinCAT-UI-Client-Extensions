import koffi = require("koffi");
koffi.pointer("HANDLE", koffi.opaque());

export interface IDeviceConnection {
    /**
     * Opens the communication with a COM port
     * @param comPort number
     */
    open(comPort: number): void;
    /**
     * Closes the communication with a COM port
     */
    close(): void;
    /**
     * Reads the serial number of the current RFID card. Returns false if no
     * card is detected.
     * @param forConfigPage True if the returned UID is displayed on the config page
     */
    readSerialNumber(forConfigPage?: boolean): string | false;
    /**
     * Gets a list of all available COM ports
     */
    listComPorts(): Uint8Array | Promise<Uint8Array>;
}

/**
 * This error is thrown if the connection with the RFID reader is lost
 */
export class ConnectionError extends Error {
    constructor(msg: string) {
        super(msg);
        this.name = "RFID_CONNECTION_ERROR";
    }
}
