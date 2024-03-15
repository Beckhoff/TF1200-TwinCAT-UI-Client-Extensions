// This reader implementation uses a custom C++ API for device communication
import { IDeviceConnection, ConnectionError } from "../RFIDCommunication";
import os = require("os");
import path = require("path");
import koffi = require("koffi");

// Check if the TwinCAT UI Client runs on a supported platform
const isx64 = os.arch() === "x64";
const isx86 = os.arch() === "ia32";

if (os.platform() !== "win32" || !(isx64 || isx86)) {
    const err = new Error("Only x86 or x64 based windows systems are supported");
    err.name = "ERR_FEATURE_UNAVAILABLE_ON_PLATFORM";
    throw err;
}

/* Possible response codes the API can return */
enum ResponseCodes {
    SUCCESS = 0x00,
    ERR_NO_KEY_DETECTED = 0x02,
    ERR_PARITY_BIT = 0x03,
    ERR_WRITE_BLOCKSIZE = 0x06,
    ERR_CAN_ONLY_READ_R_KEYS = 0x17,
    ERR_CAN_ONLY_READ_RW_KEYS = 0x18,
    ERR_UNKNOWN = 0x40, // test highest byte only (0x4x)
    ERR_WRITE_PROTECTED = 0x50,
    ERR_IO = 0xF1,
    ERR_COMMUNICATION = 0xF2,
    ERR_CONNECTION = 0xF3
}

export class EKSCom implements IDeviceConnection {

    private handle: koffi.IKoffiCType;
    private api: { GetSysComm: koffi.KoffiFunction; OpenComm: koffi.KoffiFunction; CloseComm: koffi.KoffiFunction; GetSerialNumber: koffi.KoffiFunction; GetKeyStatus: koffi.KoffiFunction; };
    private lastSerialNumber: string = null;

    /**
     * Get a list of all available COM ports
     * @returns {Uint16Array}
     */
    listComPorts(): Uint8Array {
        const buffer = new Uint8Array(257);
        const ret = this.api.GetSysComm(buffer);

        if (ret) {
            throw new Error(ret);
        }

        return buffer.subarray(1, buffer[0] + 1);
    }

    constructor() {
        const dllName = path.join(".", "bin", `EKS${isx64 ? "x64" : ""}.dll`);
        const dll = koffi.load(dllName);
        this.api = {
            GetSysComm: dll.func("void GetSysComm(unsigned char*)"),
            OpenComm: dll.func("HANDLE OpenComm(unsigned char, unsigned int)"),
            CloseComm: dll.func("void CloseComm(HANDLE)"),
            GetSerialNumber: dll.func("unsigned long GetSerialNumber(HANDLE, unsigned char*)"),
            GetKeyStatus: dll.func("unsigned long GetKeyStatus(HANDLE)")
        };
    }

    open(comPort: number): void {
        if (this.handle) {
            this.close();
        }

        this.handle = this.api.OpenComm(comPort, 9600);

        if (!this.handle) {
            throw new ConnectionError(`Unable to open COM${comPort}`);
        }
    }

    close(): void {
        this.api.CloseComm(this.handle);
    }

    readSerialNumber(): false | string {
        // If the reader already read a UID, check if the card is still inserted.
        // Querying the UID again every time would use a lot of resources
        if (this.lastSerialNumber) {
            const ret = this.api.GetKeyStatus(this.handle);

            if (ret === ResponseCodes.SUCCESS) {
                return this.lastSerialNumber;
            }
        }

        const buffer = new Uint8Array(8);
        const ret = this.api.GetSerialNumber(this.handle, buffer);

        switch (ret) {
        case ResponseCodes.SUCCESS:
        {
            // Convert Bytes to hex string
            const uid = buffer.reduce((acc, cur) => acc += cur.toString(16), "");
            this.lastSerialNumber = uid;
            return uid;
        }
        case ResponseCodes.ERR_NO_KEY_DETECTED:
            // When no key is detected, return false
            this.lastSerialNumber = null;
            return false;
        case ResponseCodes.ERR_CONNECTION:
            throw new ConnectionError("The handle is invalid");
        default:
            throw new Error(`Error while reading serial number: ${ret}`);
        }
    }
}
