// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";

contract AgentRegistryTest is Test {

    AgentRegistry public registry;
    
    // Buat 2 "akun palsu" untuk simulasi
    address public alice = makeAddr("alice"); // pemilik agent
    address public bob = makeAddr("bob");     // orang lain

    // setUp() otomatis dijalankan sebelum SETIAP test
    function setUp() public {
        registry = new AgentRegistry();
    }

    // ✅ Test 1: Register agent berhasil
    function test_RegisterAgent() public {
        string[] memory skills = new string[](2);
        skills[0] = "transcription";
        skills[1] = "ocr";

        // Simulasi: alice yang melakukan transaksi
        vm.prank(alice);
        uint256 agentId = registry.registerAgent(
            "TranscriberBot",
            skills,
            0.001 ether,
            "https://myagent.com/api"
        );

        // Cek hasilnya sesuai yang diharapkan
        (address owner, string memory name, , , bool isActive, , ) = registry.agents(agentId);
        
        assertEq(owner, alice);
        assertEq(name, "TranscriberBot");
        assertEq(isActive, true);
        assertEq(registry.agentCount(), 1);
    }

    // ✅ Test 2: Tidak bisa register dengan nama kosong
    function test_RevertIf_EmptyName() public {
        string[] memory skills = new string[](1);
        skills[0] = "transcription";

        vm.prank(alice);
        // Ekspektasi: transaksi ini HARUS gagal dengan pesan ini
        vm.expectRevert("Nama tidak boleh kosong");
        registry.registerAgent("", skills, 0.001 ether, "https://myagent.com/api");
    }

    // ✅ Test 3: Tidak bisa register dengan harga 0
    function test_RevertIf_ZeroPrice() public {
        string[] memory skills = new string[](1);
        skills[0] = "transcription";

        vm.prank(alice);
        vm.expectRevert("Harga harus lebih dari 0");
        registry.registerAgent("TestBot", skills, 0, "https://myagent.com/api");
    }

    // ✅ Test 4: Hanya owner yang bisa update agent
    function test_RevertIf_NotOwnerUpdates() public {
        string[] memory skills = new string[](1);
        skills[0] = "transcription";

        // Alice register agent
        vm.prank(alice);
        uint256 agentId = registry.registerAgent(
            "TranscriberBot", skills, 0.001 ether, "https://myagent.com/api"
        );

        // Bob coba update agent milik Alice → harus gagal
        vm.prank(bob);
        vm.expectRevert("Bukan owner agent ini");
        registry.updateAgent(agentId, 0.002 ether, "https://hacker.com");
    }

    // ✅ Test 5: Owner bisa deactivate agent nya sendiri
    function test_DeactivateAgent() public {
        string[] memory skills = new string[](1);
        skills[0] = "transcription";

        vm.prank(alice);
        uint256 agentId = registry.registerAgent(
            "TranscriberBot", skills, 0.001 ether, "https://myagent.com/api"
        );

        vm.prank(alice);
        registry.deactivateAgent(agentId);

        (,,,,bool isActive,,) = registry.agents(agentId);
        assertEq(isActive, false);
    }
}