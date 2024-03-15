#pragma once
#include <Windows.h>
#include <stdexcept>

#define EKSAPI __declspec(dllexport) __stdcall

constexpr ULONGLONG timeout = 2000;

constexpr BYTE STX = 0x02;
constexpr BYTE ETX = 0x03;
constexpr BYTE DLE = 0x10;
constexpr BYTE NAK = 0x15;

constexpr BYTE CMD_SEND = 0x54;
constexpr BYTE CMD_RESPONSE = 0x52;
constexpr BYTE CMD_WRITE = 0x50;
constexpr BYTE CMD_READ = 0x4C;
constexpr BYTE CMD_RES_STATUS = 0x46;

static BYTE accByte = DLE;
static BYTE startByte = STX;
static HANDLE hCom = INVALID_HANDLE_VALUE;
static DWORD dwErr = 0;
static COMSTAT comStat;
enum class ResponseCode : BYTE
{
    SUCCESS = 0x00,
    ERR_NO_KEY_DETECTED = 0x02,
    ERR_PARITY_BIT = 0x03,
    ERR_WRITE_BLOCKSIZE = 0x06,
    ERR_CAN_ONLY_READ_R_KEYS = 0x17,
    ERR_CAN_ONLY_READ_RW_KEYS = 0x18,
    ERR_UNKNOWN = 0x40,  // test highest byte only (0x4x)
    ERR_WRITE_PROTECTED = 0x50,
    ERR_IO = 0xF1,
    ERR_COMMUNICATION = 0xF2,
    ERR_CONNECTION = 0xF3
};

class EKSError : std::exception
{
    const char* msg;

   public:
    const ResponseCode responseCode;
    EKSError() = delete;
    EKSError(const ResponseCode& responseCode, const char* msg) noexcept : msg(msg), responseCode(responseCode){};
    EKSError(const ResponseCode& responseCode) noexcept
        : responseCode(responseCode), msg("See response code for more information"){};
    EKSError(const EKSError& other) noexcept : responseCode(other.responseCode), msg(other.msg){};
    EKSError(EKSError&& other) noexcept : msg(std::move(other.msg)), responseCode(other.responseCode){};
    const char* what() const noexcept { return msg; };
};

extern "C" VOID EKSAPI GetSysComm(BYTE* buffer);
extern "C" HANDLE EKSAPI OpenComm(unsigned char port, unsigned int baud_rate = 9600);
extern "C" VOID EKSAPI CloseComm(HANDLE pCom);
extern "C" DWORD EKSAPI GetKeyStatus(HANDLE pCom);
extern "C" DWORD EKSAPI GetSerialNumber(HANDLE pCom, BYTE* buffer);
// Dont read at byte 16 or 16 bytes. The protocol is weird when sending 0x10 and i couldn't figure it out :(
extern "C" DWORD EKSAPI ReadKeyData(HANDLE pCom, const BYTE startByte, const BYTE length, BYTE* buffer);
// Not implemented
extern "C" DWORD EKSAPI WriteKeyData(HANDLE pCom, const BYTE startByte, const BYTE length, const BYTE* buffer);