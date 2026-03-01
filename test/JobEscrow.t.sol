// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {JobEscrow} from "../src/JobEscrow.sol";

contract JobEscrowTest is Test {

    AgentRegistry public registry;
    JobEscrow public escrow;

    // Akun simulasi
    address public alice = makeAddr("alice"); // client — yang buat job
    address public bob = makeAddr("bob");     // provider — yang ngerjain job
    address public charlie = makeAddr("charlie"); // orang random
    address public platform = makeAddr("platform");

    // Data agent bob
    uint256 public bobAgentId;

    // Hash yang disepakati di awal
    bytes32 public agreedHash = keccak256("hasil transkripsi yang benar");

    function setUp() public {
        // Deploy kedua contract
        registry = new AgentRegistry();
        escrow = new JobEscrow(address(registry), platform);
        vm.deal(address(this), 1 ether);

        // Kasih ETH palsu ke alice dan bob untuk simulasi
        // vm.deal = cheat code Foundry untuk set balance wallet
        vm.deal(alice, 1 ether);
        vm.deal(bob, 1 ether);

        // Bob register agent di registry
        string[] memory skills = new string[](1);
        skills[0] = "transcription";

        vm.prank(bob);
        bobAgentId = registry.registerAgent(
            "TranscriberBot",
            skills,
            0.01 ether,
            "https://bob-agent.com/api"
        );
    }

    // ===== TEST 1: Buat job berhasil =====
    function test_CreateJob() public {
        vm.prank(alice);

        // Alice buat job dan kirim 0.01 ETH sekaligus
        // vm.prank + {value} = simulasi kirim ETH dari alice
        uint256 jobId = escrow.createJob{value: 0.01 ether}(
            bobAgentId,
            agreedHash,
            1 hours,
            "Transkripsi audio 5 menit"
        );

        // Ambil data job yang baru dibuat
        (
            uint256 id,
            address client,
            ,
            ,
            uint256 payment,
            ,
            ,
            JobEscrow.JobStatus status,
            ,
            ,
        ) = escrow.jobs(jobId);

        assertEq(id, 0);
        assertEq(client, alice);
        assertEq(payment, 0.01 ether);
        assertEq(uint256(status), 0); // 0 = CREATED

        // Cek ETH benar-benar terkunci di dalam contract
        assertEq(address(escrow).balance, 0.01 ether);
    }

    // ===== TEST 2: Accept job =====
    function test_AcceptJob() public {
        // Alice buat job dulu
        vm.prank(alice);
        uint256 jobId = escrow.createJob{value: 0.01 ether}(
            bobAgentId,
            agreedHash,
            1 hours,
            "Transkripsi audio 5 menit"
        );

        // Bob accept job
        vm.prank(bob);
        escrow.acceptJob(jobId);

        // Cek status berubah jadi ACCEPTED (1)
        (,,,,,,, JobEscrow.JobStatus status,,,) = escrow.jobs(jobId);
        assertEq(uint256(status), 1); // 1 = ACCEPTED
    }

    // ===== TEST 3: Submit hash BENAR → ETH release ke bob =====
    function test_SubmitCorrectHash_ReleasesPayment() public {
        // Setup: buat job dan accept
        vm.prank(alice);
        uint256 jobId = escrow.createJob{value: 0.01 ether}(
            bobAgentId,
            agreedHash,
            1 hours,
            "Transkripsi audio 5 menit"
        );

        vm.prank(bob);
        escrow.acceptJob(jobId);

        // Catat balance bob sebelum
        uint256 bobBalanceBefore = bob.balance;

        // Bob submit hash yang BENAR
        vm.prank(bob);
        escrow.submitResult(jobId, agreedHash);

        // Cek status COMPLETED (2)
        (,,,,,,, JobEscrow.JobStatus status,,,) = escrow.jobs(jobId);
        assertEq(uint256(status), 2); // 2 = COMPLETED

        // Cek bob dapat ETH (dikurangi 2% fee)
        // 0.01 ether - 2% = 0.0098 ether
        uint256 expectedAmount = 0.01 ether - (0.01 ether * 2 / 100);
        assertEq(bob.balance, bobBalanceBefore + expectedAmount);

        // Cek contract sudah kosong
        assertEq(address(escrow).balance, 0);
    }

    // ===== TEST 4: Submit hash SALAH → ETH balik ke alice =====
    function test_SubmitWrongHash_RefundsClient() public {
        vm.prank(alice);
        uint256 jobId = escrow.createJob{value: 0.01 ether}(
            bobAgentId,
            agreedHash,
            1 hours,
            "Transkripsi audio 5 menit"
        );

        vm.prank(bob);
        escrow.acceptJob(jobId);

        uint256 aliceBalanceBefore = alice.balance;

        // Bob submit hash yang SALAH
        bytes32 wrongHash = keccak256("hasil yang salah");
        vm.prank(bob);
        escrow.submitResult(jobId, wrongHash);

        // Cek status CANCELLED (3)
        (,,,,,,, JobEscrow.JobStatus status,,,) = escrow.jobs(jobId);
        assertEq(uint256(status), 3); // 3 = CANCELLED

        // Cek alice dapat refund penuh
        assertEq(alice.balance, aliceBalanceBefore + 0.01 ether);

        // Cek contract kosong
        assertEq(address(escrow).balance, 0);
    }

    // ===== TEST 5: Cancel job yang expired =====
    function test_CancelExpiredJob() public {
        vm.prank(alice);
        uint256 jobId = escrow.createJob{value: 0.01 ether}(
            bobAgentId,
            agreedHash,
            1 hours,
            "Transkripsi audio 5 menit"
        );

        uint256 aliceBalanceBefore = alice.balance;

        // vm.warp = cheat code Foundry untuk skip waktu
        // Kita loncat 2 jam ke depan supaya deadline terlewat
        vm.warp(block.timestamp + 2 hours);

        // Siapapun bisa cancel job yang sudah expired
        escrow.cancelExpiredJob(jobId);

        // Cek alice dapat refund
        assertEq(alice.balance, aliceBalanceBefore + 0.01 ether);
    }

    // ===== TEST 6: Orang random tidak bisa accept job =====
    function test_RevertIf_RandomPersonAccepts() public {
        vm.prank(alice);
        uint256 jobId = escrow.createJob{value: 0.01 ether}(
            bobAgentId,
            agreedHash,
            1 hours,
            "Transkripsi audio 5 menit"
        );

        // Charlie coba accept job milik bob → harus gagal
        vm.prank(charlie);
        vm.expectRevert("Bukan provider job ini");
        escrow.acceptJob(jobId);
    }
}