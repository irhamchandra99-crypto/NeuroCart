// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// =============================================================================
// NeuroCartAutomation.sol — Chainlink Automation Compatible
//
// Fungsi:
//   - checkUpkeep(): scan semua job, deteksi yang sudah expired
//   - performUpkeep(): auto-cancel job expired dan refund ke client
//
// Tidak perlu manusia yang memanggil cancelExpiredJob() satu per satu.
// Chainlink Automation node memantau dan memanggil secara otomatis.
//
// Setup: Daftarkan contract ini di https://automation.chain.link
// =============================================================================

import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

interface IJobEscrowAutomation {
    enum JobStatus { CREATED, ACCEPTED, VERIFYING, COMPLETED, CANCELLED }
    function jobs(uint256 jobId) external view returns (
        uint256 jobId_,
        address clientAgent,
        address providerAgent,
        uint256 registryAgentId,
        uint256 payment,
        uint8 paymentToken,
        string memory resultData,
        string memory jobDescription,
        string memory jobType,
        JobStatus status,
        uint256 createdAt,
        uint256 deadline,
        bytes32 verificationRequestId,
        uint8 qualityScore
    );
    function jobCount() external view returns (uint256);
    function cancelExpiredJob(uint256 jobId) external;
}

contract NeuroCartAutomation is AutomationCompatibleInterface {

    // =========================================================================
    // STATE VARIABLES
    // =========================================================================

    IJobEscrowAutomation public escrow;
    address public platformOwner;

    /// @notice Maksimal job yang di-scan per checkUpkeep (hemat gas)
    uint256 public constant MAX_SCAN_PER_CHECK = 50;

    /// @notice Maksimal job yang di-cancel per performUpkeep
    uint256 public constant MAX_CANCEL_PER_PERFORM = 10;

    // =========================================================================
    // EVENTS
    // =========================================================================

    event JobAutoCancelled(uint256 indexed jobId, uint256 timestamp);
    event UpkeepPerformed(uint256 cancelCount, uint256 timestamp);

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor(address _escrow) {
        escrow = IJobEscrowAutomation(_escrow);
        platformOwner = msg.sender;
    }

    function setEscrow(address _escrow) external {
        require(msg.sender == platformOwner, "Hanya platform owner");
        escrow = IJobEscrowAutomation(_escrow);
    }

    // =========================================================================
    // CHAINLINK AUTOMATION: checkUpkeep
    //
    // Dipanggil terus-menerus oleh Chainlink node.
    // Kembalikan (true, data) jika ada job yang perlu di-cancel.
    // =========================================================================

    function checkUpkeep(bytes calldata /* checkData */)
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        uint256 totalJobs = escrow.jobCount();
        uint256[] memory expiredJobIds = new uint256[](MAX_CANCEL_PER_PERFORM);
        uint256 count = 0;

        // Scan dari job terbaru ke lama (lebih efisien — job baru lebih mungkin expired)
        uint256 scanStart = totalJobs > MAX_SCAN_PER_CHECK ? totalJobs - MAX_SCAN_PER_CHECK : 0;

        for (uint256 i = scanStart; i < totalJobs && count < MAX_CANCEL_PER_PERFORM; i++) {
            try escrow.jobs(i) returns (
                uint256, address, address, uint256, uint256, uint8, string memory, string memory, string memory,
                IJobEscrowAutomation.JobStatus status,
                uint256, uint256 deadline, bytes32, uint8
            ) {
                bool isActiveStatus = (
                    status == IJobEscrowAutomation.JobStatus.CREATED ||
                    status == IJobEscrowAutomation.JobStatus.ACCEPTED
                );
                if (isActiveStatus && block.timestamp > deadline) {
                    expiredJobIds[count] = i;
                    count++;
                }
            } catch {
                continue;
            }
        }

        if (count > 0) {
            // Trim array ke ukuran sebenarnya
            uint256[] memory trimmed = new uint256[](count);
            for (uint256 i = 0; i < count; i++) {
                trimmed[i] = expiredJobIds[i];
            }
            return (true, abi.encode(trimmed));
        }

        return (false, "");
    }

    // =========================================================================
    // CHAINLINK AUTOMATION: performUpkeep
    //
    // Dipanggil oleh Chainlink node saat checkUpkeep return true.
    // Melakukan cancel job yang expired.
    // =========================================================================

    function performUpkeep(bytes calldata performData) external override {
        uint256[] memory jobIds = abi.decode(performData, (uint256[]));
        uint256 cancelCount = 0;

        for (uint256 i = 0; i < jobIds.length; i++) {
            uint256 jobId = jobIds[i];

            try escrow.cancelExpiredJob(jobId) {
                cancelCount++;
                emit JobAutoCancelled(jobId, block.timestamp);
            } catch {
                // Job mungkin sudah dicancel oleh tx lain, skip
                continue;
            }
        }

        emit UpkeepPerformed(cancelCount, block.timestamp);
    }
}
