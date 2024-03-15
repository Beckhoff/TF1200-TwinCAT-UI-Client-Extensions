#include "EKS.h"

static void receiveBytes(const DWORD& numberOfBytes, BYTE* buffer)
{
    DWORD _;
    ULONGLONG start = GetTickCount64();
    /* Wait until numberOfBytes bytes can be read or the connection times out */
    do
    {
        ClearCommError(hCom, &dwErr, &comStat);

        if (GetTickCount64() > start + timeout)
        {
            throw EKSError(ResponseCode::ERR_CONNECTION, "Timeout while waiting for data");
        }
    } while (comStat.cbInQue < numberOfBytes);

    /* Read bytes from com port into buffer */
    if (ReadFile(hCom, buffer, numberOfBytes, &_, NULL))
    {
        return;
    }

    throw EKSError(ResponseCode::ERR_IO, "Could not read from HANDLE");
}

static void sendBytes(const DWORD& numberOfBytes, const BYTE* buffer)
{
    DWORD _;

    /* Purge the write buffer and send bytes */
    if (PurgeComm(hCom, PURGE_TXCLEAR | PURGE_RXCLEAR | PURGE_TXABORT | PURGE_RXABORT) &&
        WriteFile(hCom, buffer, numberOfBytes, &_, NULL))
    {
        return;
    }

    throw EKSError(ResponseCode::ERR_IO, "Could not write to HANDLE");
}

static void addToCmdBuffer(BYTE* cmdBuffer, DWORD& len, BYTE& bcc, const BYTE& b)
{
    /* The DLE byte needs to be sent twice */
    if (b == DLE)
    {
        cmdBuffer[len] = DLE;
        len++;
    }

    cmdBuffer[len] = b;
    len++;
    bcc ^= b;
}

static void buildMessageBuffer(const BYTE* inBuffer, BYTE* outBuffer, DWORD& outBufferLength)
{
    const DWORD supposedLength = *inBuffer;
    DWORD actualLength = 0x00;
    BYTE bcc = 0x00;

    for (UINT i = 0; i < supposedLength; i++)
    {
        addToCmdBuffer(outBuffer, actualLength, bcc, inBuffer[i]);
    }

    outBuffer[actualLength++] = DLE;
    bcc ^= DLE;
    outBuffer[actualLength++] = ETX;
    bcc ^= ETX;
    outBuffer[actualLength++] = bcc;
    outBufferLength = actualLength;
}

static void readResponseBufferIntoBuffer(const BYTE* responseBuffer, const DWORD& supposedResponseLength,
                                         BYTE* outBuffer)
{
    /* Read response and interpret double DLE correctly */
    DWORD dleCounter = 0;
    DWORD dataCounter = 0;

    for (const BYTE* b = responseBuffer; b < responseBuffer + supposedResponseLength + dleCounter; b++)
    {
        if (*b == DLE)
        {
            dleCounter++;
            b++;
        }

        outBuffer[dataCounter++] = *b;
    }
}

static ResponseCode executeCommand(const BYTE* cmd, const DWORD& cmdLength, BYTE* buffer)
{
    try
    {
        /* INIT COMMUNICATION */
        sendBytes(1, &startByte);

        /* AWAIT DLE */
        receiveBytes(1, buffer);

        if (buffer[0] != DLE)
        {
            return ResponseCode::ERR_COMMUNICATION;
        }

        /* SEND COMMAND */
        sendBytes(cmdLength, cmd);

        /* AWAIT DLE */
        receiveBytes(1, buffer);

        if (buffer[0] != DLE)
        {
            return ResponseCode::ERR_COMMUNICATION;
        }

        /* AWAIT STX TO RECIEVE RESPONSE */
        receiveBytes(1, buffer);

        if (buffer[0] != STX)
        {
            return ResponseCode::ERR_COMMUNICATION;
        }

        /* SEND RESPONSE REQUEST */
        sendBytes(1, &accByte);

        /* READ LENGTH OF RESPONSE */
        receiveBytes(1, buffer);
        DWORD bodyLen = (DWORD)buffer[0];

        /* RECIEVE RESPONSE BODY ONE AT A TIME AND SKIP DOUBLE DLEs*/
        BYTE _ = 0;

        for (UINT i = 1; i < bodyLen; i++)
        {
            receiveBytes(1, buffer + i);

            if (buffer[i] == DLE)
            {
                receiveBytes(1, &_);
            }
        }

        /* RECIEVE MESSAGE TAIL */
        receiveBytes(3, buffer + bodyLen);

        /* SEND DLE TO END COMMUNICATION */
        sendBytes(1, &accByte);
        return ResponseCode::SUCCESS;
    }
    catch (const EKSError& err)
    {
        if (err.responseCode == ResponseCode::ERR_CONNECTION || err.responseCode == ResponseCode::ERR_IO)
        {
            return ResponseCode::ERR_CONNECTION;
        }
    }
    catch (const std::exception)
    {
        return ResponseCode::ERR_UNKNOWN;
    }

    return ResponseCode::ERR_UNKNOWN;
}

/* Get COM port info */
void EKSAPI GetSysComm(BYTE* buffer)
{
    HKEY hKEY;
    LPCTSTR data_Set = L"HARDWARE\\DEVICEMAP\\SERIALCOMM\\";
    long ret = (RegOpenKeyEx(HKEY_LOCAL_MACHINE, data_Set, 0, KEY_READ, &hKEY));

    if (ret == ERROR_SUCCESS)
    {
        DWORD dwIndex = 0, lpcchValueName = 256, lpcbData = 256;
        WCHAR lpValueName[255]{}, lpData[255]{};

        buffer[0] = 0x00;

        for (; ret == ERROR_SUCCESS; dwIndex++)
        {
            ret = RegEnumValue(hKEY, dwIndex, (LPWSTR)&lpValueName, &lpcchValueName, NULL, NULL, (LPBYTE)&lpData,
                               &lpcbData);

            if (ret == ERROR_SUCCESS)
            {
                buffer[0] += 1;
                *(buffer + buffer[0]) = _wtoi(lpData + 3);
            }

            lpcchValueName = lpcbData = 256;
        }
    }
    RegCloseKey(hKEY);
}

/* Open a COM port for communication */
HANDLE EKSAPI OpenComm(unsigned char port, unsigned int baud_rate)
{
    DCB dcb{};
    HANDLE hCom;
    WCHAR sCommPort[1024];

    wsprintf(sCommPort, L"COM%d", port);

    hCom = CreateFileW(sCommPort, GENERIC_READ | GENERIC_WRITE, 0, NULL, OPEN_EXISTING, 0, NULL);

    if (hCom == INVALID_HANDLE_VALUE)
    {
        return nullptr;
    }

    dcb.DCBlength = sizeof(dcb);

    if (!GetCommState(hCom, &dcb))
    {
        return nullptr;
    }

    dcb.BaudRate = 9600;
    dcb.ByteSize = 8;
    dcb.StopBits = ONESTOPBIT;
    dcb.Parity = EVENPARITY;

    if (!SetCommState(hCom, &dcb))
    {
        return nullptr;
    }

    return hCom;
}

/* Close a COM port */
void EKSAPI CloseComm(HANDLE pCom)
{
    PurgeComm(pCom, PURGE_RXCLEAR);
    CloseHandle(pCom);
}

/* Query CTS pin of the serial connection to determine wether a key is inserted */
DWORD EKSAPI GetKeyStatus(HANDLE pCom)
{
    DWORD dwModemStatus;

    if (!GetCommModemStatus(pCom, &dwModemStatus))
    {
        return (DWORD)ResponseCode::ERR_CONNECTION;
    }

    // When a key is inside the reader, the CTS signal is high
    if (dwModemStatus & MS_CTS_ON)
    {
        return (DWORD)ResponseCode::SUCCESS;
    }

    return (DWORD)ResponseCode::ERR_NO_KEY_DETECTED;
}

/* Read the serial number of the key */
DWORD EKSAPI GetSerialNumber(HANDLE pCom, BYTE* buffer) { return ReadKeyData(pCom, 116, 8, buffer); }

/* Read data from the key */
DWORD EKSAPI ReadKeyData(HANDLE pCom, const BYTE startByte, const BYTE length, BYTE* buffer)
{
    ResponseCode res = (ResponseCode)GetKeyStatus(pCom);

    if (res != ResponseCode::SUCCESS)
    {
        return (DWORD)res;
    }

    const BYTE cmdBuffer[]{0x07, CMD_SEND, CMD_READ, 0x01, 0x00, startByte, length};

    BYTE messageBuffer[256]{};
    DWORD messageBufferLength = 0;
    buildMessageBuffer(cmdBuffer, messageBuffer, messageBufferLength);

    hCom = pCom;
    BYTE readBuffer[256]{};

    res = executeCommand(messageBuffer, messageBufferLength, readBuffer);

    if (res != ResponseCode::SUCCESS)
    {
        return (DWORD)res;
    }

    DWORD responseLength = readBuffer[0] + 3;

    // Check correct response type
    if (readBuffer[1] != CMD_RESPONSE)
    {
        return (DWORD)ResponseCode::ERR_UNKNOWN;
    }

    if (readBuffer[2] == CMD_RES_STATUS)
    {
        // Byte number 6 is the status code on failure
        return (DWORD)readBuffer[6];
    }

    // Check correct response type
    if (readBuffer[2] != CMD_READ)
    {
        return (DWORD)ResponseCode::ERR_UNKNOWN;
    }

    memcpy(buffer, readBuffer + 7, length);
    return (DWORD)ResponseCode::SUCCESS;
}
