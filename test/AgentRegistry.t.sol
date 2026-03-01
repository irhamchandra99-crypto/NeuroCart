// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";

contract MockV3Aggregator {
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, 300000000000, block.timestamp, block.timestamp, 1); // $3000/ETH, 8 decimals
    }
}

contract AgentRegistryTest is Test {

    AgentRegistry public registry;
    MockV3Aggregator public priceFeed;

    address public alice = makeAddr("alice");
    address public bob   = makeAddr("bob");

    function setUp() public {
        priceFeed = new MockV3Aggregator();
        registry = new AgentRegistry(address(priceFeed));
        vm.deal(alice, 1 ether);
        vm.deal(bob, 1 ether);
    }

    function _registerAgent(address caller) internal returns (uint256 agentId, bytes32 erc8004Id) {
        string[] memory skills = new string[](2);
        skills[0] = "summarization";
        skills[1] = "nlp";

        vm.prank(caller);
        (agentId, erc8004Id) = registry.registerAgent{value: 0.01 ether}(
            "SummarizerBot", skills, 200, "https://myagent.com/api", "ipfs://QmMeta"
        );
    }

    // ✅ Test 1: Register agent berhasil — cek via helpers
    function test_RegisterAgent() public {
        (uint256 agentId, bytes32 erc8004Id) = _registerAgent(alice);

        assertEq(registry.getAgentOwnerAddr(agentId), alice);
        assertEq(registry.isAgentActive(agentId), true);
        assertEq(registry.getStake(erc8004Id), 0.01 ether);
        assertEq(registry.agentCount(), 1);
        assertTrue(erc8004Id != bytes32(0));
    }

    // ✅ Test 2: Tidak bisa register tanpa stake minimum
    function test_RevertIf_InsufficientStake() public {
        string[] memory skills = new string[](1);
        skills[0] = "summarization";

        vm.prank(alice);
        vm.expectRevert("Stake minimum 0.01 ETH diperlukan");
        registry.registerAgent{value: 0.001 ether}(
            "TestBot", skills, 200, "https://test.com", "ipfs://Qm"
        );
    }

    // ✅ Test 3: Tidak bisa register dengan nama kosong
    function test_RevertIf_EmptyName() public {
        string[] memory skills = new string[](1);
        skills[0] = "summarization";

        vm.prank(alice);
        vm.expectRevert("Nama tidak boleh kosong");
        registry.registerAgent{value: 0.01 ether}(
            "", skills, 200, "https://test.com", "ipfs://Qm"
        );
    }

    // ✅ Test 4: Hanya owner yang bisa update agent
    function test_RevertIf_NotOwnerUpdates() public {
        (uint256 agentId, ) = _registerAgent(alice);

        vm.prank(bob);
        vm.expectRevert("Bukan owner agent ini");
        registry.updateAgent(agentId, 300, "https://hacker.com", "ipfs://Qm");
    }

    // ✅ Test 5: Deactivate agent
    function test_DeactivateAgent() public {
        (uint256 agentId, ) = _registerAgent(alice);

        vm.prank(alice);
        registry.deactivateAgent(agentId);

        assertEq(registry.isAgentActive(agentId), false);
    }

    // ✅ Test 6: Chainlink ETH price feed
    function test_GetLatestETHPrice() public view {
        uint256 price = registry.getLatestETHPrice();
        assertEq(price, 300000000000);
    }

    // ✅ Test 7: Dynamic ETH pricing dari USD
    function test_GetRequiredETH() public {
        (uint256 agentId, ) = _registerAgent(alice);
        uint256 required = registry.getRequiredETH(agentId);
        assertGt(required, 0);
    }

    // ✅ Test 8: ERC-8004 mapping dua arah
    function test_ERC8004BidirectionalMapping() public {
        (uint256 agentId, bytes32 erc8004Id) = _registerAgent(alice);

        assertEq(registry.erc8004ToLegacyId(erc8004Id), agentId);
        assertEq(registry.legacyToErc8004Id(agentId), erc8004Id);
    }

    // ✅ Test 9: hasMinimumStake returns true setelah stake
    function test_HasMinimumStake() public {
        (, bytes32 erc8004Id) = _registerAgent(alice);
        assertEq(registry.hasMinimumStake(erc8004Id), true);
    }
}
