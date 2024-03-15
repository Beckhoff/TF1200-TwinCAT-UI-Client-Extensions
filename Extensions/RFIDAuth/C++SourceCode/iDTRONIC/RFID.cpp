// RFID.cpp : Defines the initialization routines for the DLL.
//

#include "windows.h"
#include "atlbase.h"
#include <string.h>
#include <stdio.h>
#include <time.h>
#include "RFID.h"

#define OK 0
#define FAIL -1
#define STX 0XAA
#define ETX 0XBB

#define MaxPage 12
#define MaxAddress 255    // API max address define
#define MaxTime 1         // Retry to send out data times when not reply
#define WaitReceive 2000  // After transmit waiting receiver first data
#define WaitAuthen 400    // After transmit waiting receiver first data
#define MaxBufferSize 1024

/***************************************************** Command define content *********************************************************/

// Define Mifare Application Command
#define CMD_MF_Read 0x20
#define CMD_MF_Write 0x21
#define CMD_MF_InitVal 0x22
#define CMD_MF_Dec 0x23
#define CMD_MF_Inc 0x24
#define CMD_MF_GET_SNR 0x25

// Define System Commands
#define CMD_SetAddress 0x80       // Set reader address
#define CMD_SetBaudrate 0x81      // Set reader baudrate
#define CMD_SetSerialNum 0x82     // Set reader serial number
#define CMD_GetSerialNum 0x83     // Get reader serial number
#define CMD_Write_User_Info 0x84  // Set User Information
#define CMD_Read_User_Info 0x85   // Get User Information
#define CMD_GetVersionNum 0x86    // Get reader version number

/******************************************************* End Command Define ***********************************************************/

static void CheckControlCode(unsigned char Value);
static int StartTransmit(int DeviceAddress);
static void TransmitData(void);
static int GetRecData(int Tick);
static int CheckAddress(void);

/******************************************************** Global Variable *************************************************************/

static HANDLE hComm = INVALID_HANDLE_VALUE;
static unsigned char inBuffer[1024];
static unsigned char outBuffer[1024];
static unsigned char CheckSum;
static DWORD nBytesWrite;
static int TimeCount;

/***************************************************** Global Function *****************************************************************/

static void CheckControlCode(unsigned char Value)
{
    outBuffer[nBytesWrite] = Value;
    CheckSum ^= Value;
    nBytesWrite++;
}

static int StartTransmit(int DeviceAddress)
{
    if (hComm != INVALID_HANDLE_VALUE)
    {
        outBuffer[0] = STX;
        nBytesWrite = 1;
        CheckSum = 0x00;
        CheckControlCode(DeviceAddress & 0xff);
        return (0);
    }

    return (-1);
}

void TransmitData(void)
{
    CheckControlCode(CheckSum);
    outBuffer[nBytesWrite] = ETX;
    ++nBytesWrite;

    fflush(stdout);

    PurgeComm(hComm, PURGE_TXCLEAR | PURGE_RXCLEAR | PURGE_TXABORT | PURGE_RXABORT);
    WriteFile(hComm, outBuffer, nBytesWrite, &nBytesWrite, NULL);
}

int GetRecData(int Tick)
{
    DWORD Start, StartCnt, CurrentCnt;
    DWORD length;
    DWORD nBytesRead;
    DWORD dwErrorMask;
    COMSTAT Comstate;

    CurrentCnt = StartCnt = GetTickCount64();  // Get current time tick count (ms)

    // Check reply time out
    while (CurrentCnt < (StartCnt + Tick))
    {
        ClearCommError(hComm, &dwErrorMask, &Comstate);  // Get Comstate status

        if (Comstate.cbInQue >= 3)
        {
            CurrentCnt = StartCnt + Tick;
        }
        else
        {
            // if received buffer have data then set CurrentCnt to break while loop
            CurrentCnt = GetTickCount64();
        }

        if (CurrentCnt < StartCnt)
        {
            // if GetTickCount over then initial StartCnt
            StartCnt = CurrentCnt;
        }
    }

    // ClearCommError(hComm, &dwErrorMask, &Comstate); //Get Comstate status
    if (Comstate.cbInQue >= 3)
    {
        ReadFile(hComm, inBuffer, 0x03, &nBytesRead, NULL);
        length = inBuffer[2] + 2;

        Start = CurrentCnt = StartCnt = GetTickCount64();
        while (CurrentCnt < (StartCnt + Tick))
        {                                                    // check reply time out
            ClearCommError(hComm, &dwErrorMask, &Comstate);  // Get Comstate status

            if (Comstate.cbInQue == length)
            {
                CurrentCnt = StartCnt + Tick;

                for (int i = 0; i * MaxBufferSize < (int)length; i++)
                {
                    if (Comstate.cbInQue >= MaxBufferSize)
					{
                        ReadFile(hComm, &inBuffer[3 + i * MaxBufferSize], MaxBufferSize, &nBytesRead, NULL);
					}
                    else
					{
                        ReadFile(hComm, &inBuffer[3 + i * MaxBufferSize], Comstate.cbInQue, &nBytesRead, NULL);
					}

                    ClearCommError(hComm, &dwErrorMask, &Comstate);
                }

                for (int i = 1; i < (int)length + 2; i++)
				{
					inBuffer[0] ^= inBuffer[i];
				}

                inBuffer[0] ^= STX;

                if (inBuffer[0] == 0)
				{
                    return (0);
				}

                return (1);
            }
            else
            {  // if received buffer have data then set CurrentCnt to break while loop
                CurrentCnt = GetTickCount64();
            }

            if (CurrentCnt < StartCnt)
			{
				StartCnt = CurrentCnt;
			}
        }  // End of while
    }      // End of if

    return (4);
}

int CheckAddress(void)
{
    unsigned char address = 1;

    if (inBuffer[1] != outBuffer[address])
	{
        return (1);
	}

    return (0);
}

/*
 ***************************************************************************************************************************************
 **************************************************** API Function Definition **********************************************************
 ***************************************************************************************************************************************

  Return Codes:

  *	0  success
  *	1 the parameter value out of range
  *	2 checksum error.
  *	3 Not selected COM port
  *  4 time out reply
  *  5 check sequence error
  *  7 check sum error
*/

/**************************************************** API System Function *************************************************************/

int RFID_API API_GetSysComm(unsigned char* Buffer)
{
    HKEY hKEY;
    LPCTSTR data_Set = L"HARDWARE\\DEVICEMAP\\SERIALCOMM\\";
    long ret = (::RegOpenKeyEx(HKEY_LOCAL_MACHINE, data_Set, 0, KEY_READ, &hKEY));

    if (ret == ERROR_SUCCESS)
    {
        DWORD dwIndex = 0, lpcchValueName = 256, lpcbData = 256;
        WCHAR lpValueName[255], lpData[255];

        Buffer[0] = 0x00;

        for (; ret == ERROR_SUCCESS; dwIndex++)
        {
            ret = RegEnumValue(hKEY, dwIndex, (LPWSTR)&lpValueName, &lpcchValueName, NULL, NULL, (LPBYTE)&lpData,
                               &lpcbData);

            if (ret == ERROR_SUCCESS)
            {
                Buffer[0] += 1;
                *(Buffer + Buffer[0]) = _wtoi(lpData + 3);
            }

            lpcchValueName = lpcbData = 256;
        }
    }

    ::RegCloseKey(hKEY);

    if (*Buffer == 0x00)
	{
        return 1;
	}

    return 0;
}

extern "C" HANDLE RFID_API API_OpenComm(int nCom, int nBaudrate)
{
    TCHAR szPort[15];
    HANDLE ret;
    COMMTIMEOUTS TimeOut;
    DCB dcb;
    char* setcom;
    setcom = new char[20];

    wsprintf(szPort, L"\\\\.\\COM%d", nCom);

    try
    {
        ret = CreateFile(szPort, GENERIC_READ | GENERIC_WRITE, 0, NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);

        if (ret != INVALID_HANDLE_VALUE)
        {
            SetupComm(ret, 1024, 255);  // hComm,RX_buffer,TX_buffer  //old: 512,255
            GetCommState(ret, &dcb);    // Get DCB state

            sprintf_s(setcom, 20, "%d, n, 8, 1", nBaudrate);
            int len = MultiByteToWideChar(CP_ACP, 0, setcom, -1, NULL, 0);
            LPWSTR dest = new WCHAR[len];
            MultiByteToWideChar(CP_ACP, 0, setcom, -1, dest, len);
            BuildCommDCB(dest, &dcb);
            SetCommState(ret, &dcb);
            GetCommState(ret, &dcb);
            GetCommTimeouts(ret, &TimeOut);
            TimeOut.ReadIntervalTimeout = 1000;
            SetCommTimeouts(ret, &TimeOut);
            SetCommMask(ret, EV_TXEMPTY);
            PurgeComm(ret, PURGE_TXCLEAR);
        }  // end of if(hComm)
        else
        {
            ret = 0;
        }
    }  // end try
    catch (...)
    {
        ret = 0;
    }

    delete[] setcom;
    return (ret);
}

extern "C" BOOL RFID_API API_CloseComm(HANDLE commHandle)
{
    if (commHandle != INVALID_HANDLE_VALUE)
    {
        PurgeComm(commHandle, PURGE_RXCLEAR);
        CloseHandle(commHandle);
        return TRUE;
    }

    return FALSE;
}

// 1.API_SetDeviceAddress
extern "C" int RFID_API API_SetDeviceAddress(HANDLE commHandle, int DeviceAddress, unsigned char NewAddress,
                                             unsigned char* Buffer)
{
    if (DeviceAddress > MaxAddress)
	{
		return (10);
	}

    hComm = commHandle;

    for (TimeCount = 0; TimeCount < MaxTime; TimeCount++)
    {
        if (!StartTransmit(DeviceAddress))
        {
            CheckControlCode(0x02);
            CheckControlCode(CMD_SetAddress);
            CheckControlCode(NewAddress);

            TransmitData();
            switch (GetRecData(WaitReceive + 10))
            {
                case 0:
                    Buffer[0] = inBuffer[4];  // return address
                    return (inBuffer[3]);     // status return
                case 1:                       // check sum error
                    return (7);
            }
        }
        else
		{
            return (3);
		}
    }

    return (4);
}

// 2.API_SetBaudrate
extern "C" int RFID_API API_SetBaudrate(HANDLE commHandle, int DeviceAddress, unsigned char NewBaud,
                                        unsigned char* Buffer)
{
    if (DeviceAddress > MaxAddress)
	{
		return (10);
	}

    hComm = commHandle;

    for (TimeCount = 0; TimeCount < MaxTime; TimeCount++)
    {
        if (!StartTransmit(DeviceAddress))
        {
            CheckControlCode(0x02);
            CheckControlCode(CMD_SetBaudrate);
            CheckControlCode(NewBaud);

            TransmitData();
            switch (GetRecData(WaitReceive + 10))
            {
                case 0:  // check sum success
                    if (!CheckAddress())
                    {
                        Buffer[0] = inBuffer[4];
                        return (inBuffer[3]);  // status return
                    }
                    else
					{
                        return (5);
					}
                case 1:  // check sum error
                    return (7);
            }
        }
        else
		{
            return (3);
		}
    }

    return (4);
}

// 3.API_SetSerNum
extern "C" int RFID_API API_SetSerNum(HANDLE commHandle, int DeviceAddress, unsigned char* NewValue,
                                      unsigned char* Buffer)
{
    if (DeviceAddress > MaxAddress)
	{
		return (10);
	}

    hComm = commHandle;

    for (TimeCount = 0; TimeCount < MaxTime; TimeCount++)
    {
        if (!StartTransmit(DeviceAddress))
        {
            CheckControlCode(0x09);
            CheckControlCode(CMD_SetSerialNum);

            for (int n = 0; n < 8; n++)
			{
				CheckControlCode(NewValue[n]);
			}

            TransmitData();

            switch (GetRecData(WaitReceive + 10))
            {
                case 0:  // check sum success
                    if (!CheckAddress())
                    {
                        Buffer[0] = inBuffer[4];  // return DATA[0]
                        return (inBuffer[3]);     // status return
                    }
                    else
					{
                        return (5);
					}
                case 1:  // check sum error
                    return (7);
            }
        }
        else
		{
            return (3);
		}
    }

    return (4);
}

// 4.API_GetSerNum
extern "C" int RFID_API API_GetSerNum(HANDLE commHandle, int DeviceAddress, unsigned char* Buffer)
{
    if (DeviceAddress > MaxAddress)
	{
		return (10);
	}

    hComm = commHandle;

    for (TimeCount = 0; TimeCount < MaxTime; TimeCount++)
    {
        if (!StartTransmit(DeviceAddress))
        {
            CheckControlCode(0x01);
            CheckControlCode(CMD_GetSerialNum);

            TransmitData();
            switch (GetRecData(WaitReceive + 10))
            {
                case 0:
                {  // check sum success
                    Buffer[0] = inBuffer[2] - 1;
                    memcpy(&Buffer[1], &inBuffer[4], Buffer[0]);  // return SerialNum
                    return (inBuffer[3]);
                }
                case 1:  // check sum error
                    return (7);
            }
        }
        else
		{
            return (3);
		}
    }

    return (4);
}

// 7.API_GetVersionNum
extern "C" int RFID_API API_GetVersionNum(HANDLE commHandle, int DeviceAddress, char* VersionNum)
{
    if (DeviceAddress > MaxAddress)
	{
		return (10);
	}

    hComm = commHandle;

    // delay()
    TimeCount = GetTickCount64();

    for (int timeout = TimeCount + 200; TimeCount < timeout;)
	{
		TimeCount = GetTickCount64();
	}

    for (TimeCount = 0; TimeCount < MaxTime; TimeCount++)
    {
        if (!StartTransmit(DeviceAddress))
        {
            CheckControlCode(0x01);
            CheckControlCode(CMD_GetVersionNum);

            TransmitData();
            switch (GetRecData(WaitReceive))
            {
                case 0:  // check sum success
                    if (!CheckAddress())
                    {
                        if (inBuffer[3] == OK)
                        {
                            memcpy(VersionNum, &inBuffer[4], inBuffer[2] - 1);  // nBytesRead
                        }

                        return (inBuffer[3]);
                    }
                    else
					{
                        return (5);
					}
                case 1:  // check sum error
                    return (7);
            }
        }
        else
		{
            return (3);
		}
    }

    return (4);
}

/******************************************************* API Mifare Application Function *********************************************************/

// 1.API_MF_Read()
extern "C" int RFID_API API_MF_Read(HANDLE commHandle, int DeviceAddress, unsigned char mode, unsigned char blk_add,
                                    unsigned char num_blk, unsigned char* key, unsigned char* Buffer)
{
    int StartCnt;

    if (DeviceAddress > MaxAddress || num_blk <= 0)
	{
		return (10);
	}

    hComm = commHandle;

    for (int Retry = 0; Retry < MaxTime; Retry++)
    {
        if (!StartTransmit(DeviceAddress))
        {
            if (key != NULL)
            {
                CheckControlCode(0x0A);
                CheckControlCode(CMD_MF_Read);
                CheckControlCode(mode);
                CheckControlCode(num_blk);
                CheckControlCode(blk_add);

                for (int i = 0; i < 6; i++)
				{
					CheckControlCode(key[i]);
				}
            }
            else
            {
                CheckControlCode(0x04);
                CheckControlCode(CMD_MF_Read);
                CheckControlCode(mode);
                CheckControlCode(num_blk);
                CheckControlCode(blk_add);
            }

            TransmitData();

            StartCnt = (WaitReceive + (num_blk >> 4) * WaitReceive + 30);

            switch (GetRecData(StartCnt))
            {
                case 0:  // check sum success
                    if (CheckAddress() == 0x00)
                    {
                        if (inBuffer[3] == OK)
                        {
                            Buffer[0] = inBuffer[2] - 1;
                            memcpy(&Buffer[1], &inBuffer[4], Buffer[0]);
                        }
                        else
                        {
                            Buffer[0] = inBuffer[4];
                        }

                        return (inBuffer[3]);
                    }
                    else
					{
                        return (5);
					}
                case 1:  // check sum error
                    return (7);
            }  // End of switch case deoce recevied data
        }
        else
		{
            return (3);
		}
    }

    return (4);
}

// 2.API_MF_Write()
extern "C" int RFID_API API_MF_Write(HANDLE commHandle, int DeviceAddress, unsigned char mode, unsigned char blk_add,
                                     unsigned char num_blk, unsigned char* key, unsigned char* senddata,
                                     unsigned char* Buffer)
{
    int length, WaitTick;

    if (DeviceAddress > MaxAddress || num_blk > MaxPage || num_blk <= 0x00)
	{
		return (10);
	}

    hComm = commHandle;

    for (int TimeCount = 0; TimeCount < MaxTime; TimeCount++)
    {
        if (!StartTransmit(DeviceAddress))
        {
            if (key != NULL)
            {
                length = num_blk * 16;
                CheckControlCode(length + 0x0A);
                CheckControlCode(CMD_MF_Write);
                CheckControlCode(mode);
                CheckControlCode(num_blk);
                CheckControlCode(blk_add);

                for (int i = 0; i < 6; i++)
                {
                    CheckControlCode(key[i]);
                }

                for (int i = 0; i < length; i++)
                {
                    CheckControlCode(senddata[i]);
                }
            }
            else
            {
                length = num_blk * 4;
                CheckControlCode(length + 0x04);
                CheckControlCode(CMD_MF_Write);
                CheckControlCode(mode);
                CheckControlCode(num_blk);
                CheckControlCode(blk_add);

                for (int i = 0; i < 4; i++)
                {
                    CheckControlCode(senddata[i]);
                }
            }

            TransmitData();

            WaitTick = (WaitReceive + num_blk * WaitReceive);

            switch (GetRecData(WaitTick))
            {
                case 0:  // check sum success
                    if (!CheckAddress())
                    {
                        if (inBuffer[3] == OK)
                        {
                            Buffer[0] = inBuffer[2] - 1;
                            memcpy(&Buffer[1], &inBuffer[4], Buffer[0]);
                        }
                        else
                        {
                            Buffer[0] = inBuffer[4];
                        }

                        return (inBuffer[3]);  // return status
                    }
                    else
					{
                        return (5);
					}
                case 1:  // check sum error
                    return (7);
            }  // End of switch case deoce recevied data
        }
        else
		{
            return (3);
		}
    }

    return (4);
}

// 3.API_MF_InitVal()
extern "C" int RFID_API API_MF_InitVal(HANDLE commHandle, int DeviceAddress, unsigned char mode, unsigned char sec_num,
                                       unsigned char* key, unsigned char* value, unsigned char* Buffer)
{
    int WaitTick;

    if (DeviceAddress > MaxAddress)
	{
		return (10);
	}

    hComm = commHandle;

    for (int TimeCount = 0; TimeCount < MaxTime; TimeCount++)
    {
        if (!StartTransmit(DeviceAddress))
        {
            CheckControlCode(0x0D);
            CheckControlCode(CMD_MF_InitVal);
            CheckControlCode(mode);
            CheckControlCode(sec_num);
            CheckControlCode(key[0]);
            CheckControlCode(key[1]);
            CheckControlCode(key[2]);
            CheckControlCode(key[3]);
            CheckControlCode(key[4]);
            CheckControlCode(key[5]);

            CheckControlCode(value[0]);
            CheckControlCode(value[1]);
            CheckControlCode(value[2]);
            CheckControlCode(value[3]);

            TransmitData();

            WaitTick = WaitReceive;

            switch (GetRecData(WaitTick))
            {
                case 0:  // check sum success
                    if (!CheckAddress())
                    {
                        if (inBuffer[3] == OK)
                        {
                            Buffer[0] = inBuffer[2] - 1;
                            memcpy(&Buffer[1], &inBuffer[4], Buffer[0]);
                        }
                        else
                        {
                            Buffer[0] = inBuffer[4];
                        }

                        return (inBuffer[3]);
                    }
                    else
					{
                        return (5);
					}
                case 1:  // check sum error
                    return (7);
            }  // End of switch case deoce recevied data
        }
        else
		{
            return (3);
		}
    }

    return (4);
}

// 4.API_MF_Dec();
extern "C" int RFID_API API_MF_Dec(HANDLE commHandle, int DeviceAddress, unsigned char mode, unsigned char sec_num,
                                   unsigned char* key, unsigned char* value, unsigned char* Buffer)
{
    int WaitTick;

    if (DeviceAddress > MaxAddress)
	{
		return (10);
	}

    hComm = commHandle;

    if (!StartTransmit(DeviceAddress))
    {
        CheckControlCode(0x0d);
        CheckControlCode(CMD_MF_Dec);
        CheckControlCode(mode);
        CheckControlCode(sec_num);
        CheckControlCode(key[0]);
        CheckControlCode(key[1]);
        CheckControlCode(key[2]);
        CheckControlCode(key[3]);
        CheckControlCode(key[4]);
        CheckControlCode(key[5]);
        CheckControlCode(value[0]);
        CheckControlCode(value[1]);
        CheckControlCode(value[2]);
        CheckControlCode(value[3]);

        TransmitData();

        WaitTick = WaitReceive;

        switch (GetRecData(WaitTick))
        {
            case 0:  // check sum success
                if (!CheckAddress())
                {
                    if (inBuffer[3] == OK)
                    {
                        Buffer[0] = inBuffer[2] - 1;
                        memcpy(&Buffer[1], &inBuffer[4], Buffer[0]);
                    }
                    else
                    {
                        Buffer[0] = inBuffer[4];
                    }

                    return (inBuffer[3]);
                }
                else
				{
                    return (5);
				}
            case 1:  // check sum error
                return (7);
        }  // End of switch case deoce recevied data
    }
    else
	{
        return (3);
	}

    return (4);
}

// 5.API_MF_Inc()
extern "C" int RFID_API API_MF_Inc(HANDLE commHandle, int DeviceAddress, unsigned char mode, unsigned char sec_num,
                                   unsigned char* key, unsigned char* value, unsigned char* Buffer)
{
    int WaitTick;

    if (DeviceAddress > MaxAddress)
	{
		return (10);
	}

    hComm = commHandle;

    if (!StartTransmit(DeviceAddress))
    {
        CheckControlCode(0x0d);
        CheckControlCode(CMD_MF_Inc);
        CheckControlCode(mode);
        CheckControlCode(sec_num);
        CheckControlCode(key[0]);
        CheckControlCode(key[1]);
        CheckControlCode(key[2]);
        CheckControlCode(key[3]);
        CheckControlCode(key[4]);
        CheckControlCode(key[5]);
        CheckControlCode(value[0]);
        CheckControlCode(value[1]);
        CheckControlCode(value[2]);
        CheckControlCode(value[3]);

        TransmitData();

        WaitTick = WaitReceive;

        switch (GetRecData(WaitTick))
        {
            case 0:  // check sum success
                if (!CheckAddress())
                {
                    if (inBuffer[3] == OK)
                    {
                        Buffer[0] = inBuffer[2] - 1;
                        memcpy(&Buffer[1], &inBuffer[4], Buffer[0]);
                    }
                    else
                    {
                        Buffer[0] = inBuffer[4];
                    }

                    return (inBuffer[3]);
                }
                else
				{
                    return (5);
				}
            case 1:  // check sum error
                return (7);
        }  // End of switch case deoce recevied data
    }
    else
	{
        return (3);
	}

    return (4);
}

// 6.API_MF_GET_SNR()
extern "C" int RFID_API API_MF_GET_SNR(HANDLE commHandle, int DeviceAddress, unsigned char mode, unsigned char cmd,
                                       unsigned char* Buffer)
{
    if (DeviceAddress > MaxAddress)
	{
		return (10);
	}

    hComm = commHandle;

    for (int TimeCount = 0; TimeCount < MaxTime; TimeCount++)
    {
        if (!StartTransmit(DeviceAddress))
        {
            CheckControlCode(0x03);
            CheckControlCode(CMD_MF_GET_SNR);
            CheckControlCode(mode);
            CheckControlCode(cmd);

            TransmitData();

            switch (GetRecData(WaitReceive))
            {
                case 0:  // check sum success
                    if (!CheckAddress())
                    {
                        if (inBuffer[3] == OK)
                        {
                            Buffer[0] = inBuffer[2] - 1;
                            memcpy(&Buffer[1], &inBuffer[4], Buffer[0]);
                        }
                        else
                        {
                            Buffer[0] = inBuffer[4];
                        }

                        return (inBuffer[3]);
                    }
                    else
					{
                        return (5);
					}
                case 1:  // check sum error
                    return (7);
            }  // End of switch case deoce recevied data
        }
        else
		{
            return (3);
		}
    }

    return (4);
}