// This reader implementation uses NodeJS serial API instead of a C++ API. The
// serial port listens for incoming data from the reader. The reader sends the
// UID  of a detected card automatically.
import { SerialPort } from "serialport";
import { IDeviceConnection, ConnectionError } from "../RFIDCommunication";

export class Baltech implements IDeviceConnection {
    private serialConnection: SerialPort;
    private lastSrn: string = null;
    private lastSrnRead = false;
    private hasError = false;

    async listComPorts(): Promise<Uint8Array> {
        const portList = await SerialPort.list();
        return Uint8Array.from(
            portList.map(value => Number(value.path.substring(3)))
        );
    }

    open(comPort: number) {
        this.hasError = false;
        // Close the current connection before opening a new one
        if (this.serialConnection?.isOpen) {
            this.serialConnection.close();
        }

        this.serialConnection = new SerialPort({
            path: `COM${comPort}`,
            baudRate: 9600,
            parity: "none"
        });
        this.serialConnection.on("data", data => {
            // Decode the data from ascii and treat it as a hex string
            const hexString = (data as Buffer).toString("ascii");
            // Parse the string into a buffer to reverse the byte order
            const byteArray = Buffer.from(hexString, "hex").reverse();
            // Encode the buffer as a hex string again.
            this.lastSrn = byteArray.toString("hex");
            this.lastSrnRead = false;
        });
        /* eslint-disable-next-line @typescript-eslint/no-unused-vars*/
        this.serialConnection.once("error", err => {
            this.hasError = true;
        });
    }

    close(): void {
        this.serialConnection.close();
    }

    readSerialNumber(forConfigPage?: boolean): string | false {
        // If there is a connection error, throw an error
        if (this.hasError) {
            throw new ConnectionError("Device not available");
        }

        // If the serial number is read for the config page, return the last UID received
        // from the reader
        if (forConfigPage) {
            return this.lastSrn;
        }

        // Since this reader setup cannot detect when cards are removed, the UID is only sent
        // the first time it is requested. After that, "false" will be returned
        if (!this.lastSrnRead) {
            this.lastSrnRead = true;
            return this.lastSrn;
        }

        return false;
    }
}
