#pragma once
#include "Windows.h"

#define RFID_API __declspec(dllexport) __stdcall

// System Command Function
extern "C" int RFID_API API_GetSysComm(unsigned char* Buffer);
extern "C" HANDLE RFID_API API_OpenComm(int nCom, int nBaudrate);
extern "C" BOOL RFID_API API_CloseComm(HANDLE commHandle);
extern "C" int RFID_API API_SetDeviceAddress(HANDLE commHandle, int DeviceAddress, unsigned char NewAddr,
                                             unsigned char* Buffer);
extern "C" int RFID_API API_SetBaudrate(HANDLE commHandle, int DeviceAddress, unsigned char NewBaud,
                                        unsigned char* Buffer);
extern "C" int RFID_API API_SetSerNum(HANDLE commHandle, int DeviceAddress, unsigned char* NewValue,
                                      unsigned char* Buffer);
extern "C" int RFID_API API_GetSerNum(HANDLE commHandle, int DeviceAddress, unsigned char* Buffer);
extern "C" int RFID_API API_GetVersionNum(HANDLE commHandle, int DeviceAddress, char* VersionNum);

// Mifare Application Function
extern "C" int RFID_API API_MF_Read(HANDLE commHandle, int DeviceAddress, unsigned char mode, unsigned char blk_add,
                                    unsigned char num_blk, unsigned char* key, unsigned char* Buffer);
extern "C" int RFID_API API_MF_Write(HANDLE commHandle, int DeviceAddress, unsigned char mode, unsigned char blk_add,
                                     unsigned char num_blk, unsigned char* key, unsigned char* senddata,
                                     unsigned char* Buffer);
extern "C" int RFID_API API_MF_InitVal(HANDLE commHandle, int DeviceAddress, unsigned char mode, unsigned char sec_num,
                                       unsigned char* key, unsigned char* value, unsigned char* Buffer);
extern "C" int RFID_API API_MF_Dec(HANDLE commHandle, int DeviceAddress, unsigned char mode, unsigned char sec_num,
                                   unsigned char* key, unsigned char* value, unsigned char* Buffer);
extern "C" int RFID_API API_MF_Inc(HANDLE commHandle, int DeviceAddress, unsigned char mode, unsigned char sec_num,
                                   unsigned char* key, unsigned char* value, unsigned char* Buffer);
extern "C" int RFID_API API_MF_GET_SNR(HANDLE commHandle, int DeviceAddress, unsigned char mode, unsigned char cmd,
                                       unsigned char* Buffer);