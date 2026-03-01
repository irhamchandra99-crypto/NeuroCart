// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {JobEscrow} from "../src/JobEscrow.sol";

contract MockV3Aggregator {
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, 300000000000, block.timestamp, block.timestamp, 1);
    }
}

contract MockUSDC {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount; return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "Allowance tidak cukup");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MockFunctions {
    JobEscrow public escrow;

    function setEscrow(address _escrow) external { escrow = JobEscrow(_escrow); }

    function requestVerification(uint256 jobId, string calldata, string calldata)
        external returns (bytes32)
    {
        return keccak256(abi.encodePacked(jobId, block.timestamp));
    }

    function simulateFulfill(uint256 jobId, bool passed, uint8 score) external {
        escrow.finalizeVerification(jobId, passed, score);
    }
}

contract JobEscrowTest is Test {

    AgentRegistry public registry;
    JobEscrow public escrow;
    MockV3Aggregator public priceFeed;
    MockUSDC public usdc;
    MockFunctions public mockFunctions;

    address public admin   = makeAddr("admin");
    address public alice   = makeAddr("alice");
    address public bob     = makeAddr("bob");
    address public charlie = makeAddr("charlie");

    uint256 public bobAgentId;

    function setUp() public {
        vm.deal(admin, 1 ether);
        vm.deal(alice, 2 ether);
        vm.deal(bob, 2 ether);

        // Deploy semua contract sebagai admin
        vm.startPrank(admin);
        priceFeed = new MockV3Aggregator();
        usdc = new MockUSDC();
        registry = new AgentRegistry(address(priceFeed));
        escrow = new JobEscrow(address(registry), admin, address(usdc));
        mockFunctions = new MockFunctions();

        // Wiring
        registry.setEscrowContract(address(escrow));
        escrow.setFunctionsContract(address(mockFunctions));
        mockFunctions.setEscrow(address(escrow));
        vm.stopPrank();

        // Bob register agent
        string[] memory skills = new string[](1);
        skills[0] = "summarization";

        vm.prank(bob);
        (bobAgentId, ) = registry.registerAgent{value: 0.01 ether}(
            "SummarizerBot", skills, 200,
            "https://bob-agent.com/api", "ipfs://QmBob"
        );
    }

    // ===== TEST 1: Buat job ETH =====
    function test_CreateJobETH() public {
        vm.prank(alice);
        uint256 jobId = escrow.createJob{value: 0.01 ether}(
            bobAgentId, 3600, "Ringkas artikel ini", "summarization"
        );

        assertEq(address(escrow).balance, 0.01 ether);
        assertEq(uint256(escrow.getJobStatus(jobId)), 0); // CREATED
    }

    // ===== TEST 2: Accept job =====
    function test_AcceptJob() public {
        vm.prank(alice);
        uint256 jobId = escrow.createJob{value: 0.01 ether}(
            bobAgentId, 3600, "Ringkas artikel", "summarization"
        );

        vm.prank(bob);
        escrow.acceptJob(jobId);

        assertEq(uint256(escrow.getJobStatus(jobId)), 1); // ACCEPTED
    }

    // ===== TEST 3: Submit result → status VERIFYING =====
    function test_SubmitResult_StartsVerification() public {
        vm.prank(alice);
        uint256 jobId = escrow.createJob{value: 0.01 ether}(
            bobAgentId, 3600, "Ringkas artikel", "summarization"
        );
        vm.prank(bob);
        escrow.acceptJob(jobId);
        vm.prank(bob);
        escrow.submitResult(jobId, "Ringkasan berkualitas tinggi.");

        assertEq(uint256(escrow.getJobStatus(jobId)), 2); // VERIFYING
    }

    // ===== TEST 4: Verification PASS → payment release =====
    function test_VerificationPass_ReleasesPayment() public {
        vm.prank(alice);
        uint256 jobId = escrow.createJob{value: 0.01 ether}(
            bobAgentId, 3600, "Ringkas artikel", "summarization"
        );
        vm.prank(bob);
        escrow.acceptJob(jobId);
        vm.prank(bob);
        escrow.submitResult(jobId, "Ringkasan berkualitas tinggi.");

        uint256 bobBefore = bob.balance;

        // Simulasi DON: skor 92 (di atas threshold 80)
        mockFunctions.simulateFulfill(jobId, true, 92);

        assertEq(uint256(escrow.getJobStatus(jobId)), 3); // COMPLETED
        assertGt(bob.balance, bobBefore);
    }

    // ===== TEST 5: Verification FAIL → refund ke client =====
    function test_VerificationFail_RefundsClient() public {
        vm.prank(alice);
        uint256 jobId = escrow.createJob{value: 0.01 ether}(
            bobAgentId, 3600, "Ringkas artikel", "summarization"
        );
        vm.prank(bob);
        escrow.acceptJob(jobId);
        vm.prank(bob);
        escrow.submitResult(jobId, "Hasil jelek.");

        uint256 aliceBefore = alice.balance;

        // Simulasi DON: skor 55 (di bawah threshold 80)
        mockFunctions.simulateFulfill(jobId, false, 55);

        assertEq(uint256(escrow.getJobStatus(jobId)), 4); // CANCELLED
        assertEq(alice.balance, aliceBefore + 0.01 ether);
    }

    // ===== TEST 6: Cancel expired job =====
    function test_CancelExpiredJob() public {
        vm.prank(alice);
        uint256 jobId = escrow.createJob{value: 0.01 ether}(
            bobAgentId, 3600, "Ringkas artikel", "summarization"
        );

        uint256 aliceBefore = alice.balance;
        vm.warp(block.timestamp + 2 hours);
        escrow.cancelExpiredJob(jobId);

        assertEq(uint256(escrow.getJobStatus(jobId)), 4); // CANCELLED
        assertEq(alice.balance, aliceBefore + 0.01 ether);
    }

    // ===== TEST 7: Random tidak bisa accept =====
    function test_RevertIf_RandomPersonAccepts() public {
        vm.prank(alice);
        uint256 jobId = escrow.createJob{value: 0.01 ether}(
            bobAgentId, 3600, "Ringkas artikel", "summarization"
        );

        vm.prank(charlie);
        vm.expectRevert("Bukan provider job ini");
        escrow.acceptJob(jobId);
    }

    // ===== TEST 8: Buat job USDC =====
    function test_CreateJobUSDC() public {
        uint256 usdcAmount = 2_000_000; // 2 USDC
        usdc.mint(alice, usdcAmount);

        vm.prank(alice);
        usdc.approve(address(escrow), usdcAmount);

        vm.prank(alice);
        uint256 jobId = escrow.createJobUSDC(
            bobAgentId, usdcAmount, 3600, "Ringkas artikel", "summarization"
        );

        assertEq(uint256(escrow.getJobStatus(jobId)), 0); // CREATED
        assertEq(usdc.balanceOf(address(escrow)), usdcAmount);
    }
}
