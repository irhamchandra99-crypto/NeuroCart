# agent_sdk.py v2.0 — Event-driven + ERC-8004 + x402 support
#
# Upgrade dari v1:
#   ✅ Event-driven (tidak ada lagi polling setiap 5 detik)
#   ✅ ERC-8004 compliant registerAgent (pakai staking + metadataURI)
#   ✅ Mendukung USDC payment via createJobUSDC()
#   ✅ submitResult() baru (hanya kirim string, tidak perlu hash)
#   ✅ Track VERIFYING status (menunggu Chainlink Functions)

import time
import threading
from web3 import Web3
from dotenv import load_dotenv
import os

from contracts import load_abi, CONTRACT_ADDRESSES, NETWORKS
from utils import connect_web3, get_account, send_transaction, to_wei, from_wei

load_dotenv()

class AgentSDK:
    """
    SDK v2.0 untuk berinteraksi dengan NeuroCart AI Agent Marketplace.

    Cara pakai:

        sdk = AgentSDK(private_key="0x...", network="arbitrum_sepolia")

        # Register sebagai agent provider (ERC-8004 compliant)
        agent_id, erc8004_id = sdk.register_agent(
            name="SummarizerBot",
            skills=["summarization", "nlp"],
            price_usd_cents=200,         # $2.00 per call
            endpoint="https://mybot.com/api",  # x402-enabled endpoint
            metadata_uri="ipfs://QmMetadata"   # ERC-8004 metadata
        )

        # Listen job via blockchain events (bukan polling)
        sdk.listen_for_jobs(agent_id, handler=my_handler_function)
    """

    def __init__(self, private_key: str = None, network: str = "arbitrum_sepolia"):
        self.private_key = private_key or os.getenv("PRIVATE_KEY")
        if not self.private_key:
            raise ValueError("Private key tidak ditemukan! Set PRIVATE_KEY di file .env")

        network_config = NETWORKS.get(network)
        if not network_config:
            raise ValueError(f"Network '{network}' tidak dikenal. Pilih: {list(NETWORKS.keys())}")

        self.network = network
        self.w3 = connect_web3(network_config["rpc_url"])
        self.account = get_account(self.w3, self.private_key)

        addresses = CONTRACT_ADDRESSES.get(network, {})

        # Load ABIs
        registry_abi = load_abi("AgentRegistry")
        escrow_abi = load_abi("JobEscrow")

        # Instantiate contracts
        registry_addr = addresses.get("AgentRegistry", "")
        escrow_addr   = addresses.get("JobEscrow", "")

        if registry_addr:
            self.registry = self.w3.eth.contract(
                address=Web3.to_checksum_address(registry_addr),
                abi=registry_abi
            )
        else:
            self.registry = None
            print("⚠️  AgentRegistry address belum diset di contracts.py")

        if escrow_addr:
            self.escrow = self.w3.eth.contract(
                address=Web3.to_checksum_address(escrow_addr),
                abi=escrow_abi
            )
        else:
            self.escrow = None
            print("⚠️  JobEscrow address belum diset di contracts.py")

        print(f"🚀 AgentSDK v2.0 siap! Network: {network_config['name']}")
        print(f"   Wallet: {self.account.address}")

    # ==========================================================================
    # BAGIAN 1: REGISTER AGENT (ERC-8004 Compliant)
    # ==========================================================================

    def register_agent(
        self,
        name: str,
        skills: list,
        price_usd_cents: int,
        endpoint: str,
        metadata_uri: str = "",
        stake_eth: float = 0.01
    ) -> tuple:
        """
        Daftarkan AI agent ke marketplace (ERC-8004 compliant).

        Parameter:
        - name:            nama agent, contoh "SummarizerBot"
        - skills:          list skill, contoh ["summarization", "nlp"]
        - price_usd_cents: harga per call dalam USD cents, contoh 200 = $2.00
        - endpoint:        URL x402-enabled HTTP endpoint agent
        - metadata_uri:    IPFS/HTTPS URI untuk metadata agent (ERC-8004)
        - stake_eth:       jumlah ETH yang di-stake (minimum 0.01)

        Return: (agent_id, erc8004_id)
        """
        if not self.registry:
            raise RuntimeError("Registry contract belum diset!")
        if stake_eth < 0.01:
            raise ValueError("Stake minimum 0.01 ETH")

        print(f"\n📝 Mendaftarkan agent '{name}' (ERC-8004 compliant)...")
        print(f"   Skills: {skills}")
        print(f"   Harga: ${price_usd_cents/100:.2f} USD per call")
        print(f"   Endpoint (x402): {endpoint}")
        print(f"   Stake: {stake_eth} ETH")

        stake_wei = to_wei(stake_eth)

        transaction = self.registry.functions.registerAgent(
            name,
            skills,
            price_usd_cents,
            endpoint,
            metadata_uri
        ).build_transaction({
            'from': self.account.address,
            'value': stake_wei,
            'chainId': self.w3.eth.chain_id,
            'gasPrice': self.w3.eth.gas_price,
        })

        receipt = send_transaction(self.w3, self.account, transaction)

        # Parse event AgentRegistered untuk ambil agentId dan erc8004Id
        events = self.registry.events.AgentRegistered().process_receipt(receipt)
        if events:
            agent_id   = events[0]['args']['agentId']
            erc8004_id = events[0]['args']['erc8004Id']
            print(f"✅ Agent terdaftar!")
            print(f"   Legacy Agent ID: {agent_id}")
            print(f"   ERC-8004 ID: {erc8004_id.hex()}")
            return agent_id, erc8004_id
        else:
            raise RuntimeError("Gagal mendapatkan agent ID dari event")

    # ==========================================================================
    # BAGIAN 2: LISTEN JOB (Event-driven, bukan polling)
    # ==========================================================================

    def listen_for_jobs(self, agent_id: int, handler, poll_interval: int = 2):
        """
        Listen job baru via blockchain events (lebih efisien dari polling).

        Event yang di-listen: JobAccepted (setelah kita accept) + JobCreated (baru masuk)

        Parameter:
        - agent_id:      ID agent yang mau dipantau
        - handler:       fungsi yang dipanggil saat ada job baru
                         handler(job_id, job_data) → str (hasil AI)
        - poll_interval: interval cek event baru (detik), default 2
        """
        if not self.escrow:
            raise RuntimeError("Escrow contract belum diset!")

        print(f"\n👂 Listening job untuk Agent ID: {agent_id}")
        print(f"   Mode: Event-driven (interval {poll_interval}s)")
        print(f"   Tekan Ctrl+C untuk stop\n")

        processed_jobs = set()
        last_block = self.w3.eth.block_number

        while True:
            try:
                current_block = self.w3.eth.block_number

                if current_block > last_block:
                    # Filter event JobCreated dari last_block sampai current_block
                    job_created_filter = self.escrow.events.JobCreated.create_filter(
                        from_block=last_block + 1,
                        to_block=current_block,
                        argument_filters={'agentId': agent_id}
                    )

                    for event in job_created_filter.get_all_entries():
                        job_id = event['args']['jobId']

                        if job_id in processed_jobs:
                            continue

                        print(f"\n🔔 Job baru ditemukan! Job ID: {job_id}")
                        job_data = self._get_job_data(job_id)
                        print(f"   Deskripsi: {job_data['description']}")
                        print(f"   Tipe: {job_data['job_type']}")
                        print(f"   Payment: {job_data['payment_eth']} ETH")

                        # Auto-accept job
                        self._accept_job(job_id)

                        # Jalankan AI handler
                        try:
                            result = handler(job_id, job_data)
                            if result:
                                self._submit_result(job_id, result)
                        except Exception as e:
                            print(f"❌ Error di handler: {e}")

                        processed_jobs.add(job_id)

                    last_block = current_block

                time.sleep(poll_interval)

            except KeyboardInterrupt:
                print("\n👋 Listen dihentikan.")
                break
            except Exception as e:
                print(f"❌ Error: {e}")
                time.sleep(poll_interval)

    # ==========================================================================
    # BAGIAN 3: BUAT JOB (sebagai client)
    # ==========================================================================

    def create_job_eth(
        self,
        provider_agent_id: int,
        deadline_seconds: int,
        description: str,
        job_type: str,
        payment_eth: float
    ) -> int:
        """
        Buat job baru dengan pembayaran ETH.

        Return: job_id
        """
        if not self.escrow:
            raise RuntimeError("Escrow contract belum diset!")

        print(f"\n📋 Membuat job baru...")
        print(f"   Agent ID: {provider_agent_id}")
        print(f"   Tipe: {job_type}")
        print(f"   Payment: {payment_eth} ETH")

        payment_wei = to_wei(payment_eth)

        transaction = self.escrow.functions.createJob(
            provider_agent_id,
            deadline_seconds,
            description,
            job_type
        ).build_transaction({
            'from': self.account.address,
            'value': payment_wei,
            'chainId': self.w3.eth.chain_id,
            'gasPrice': self.w3.eth.gas_price,
        })

        receipt = send_transaction(self.w3, self.account, transaction)

        events = self.escrow.events.JobCreated().process_receipt(receipt)
        if events:
            job_id = events[0]['args']['jobId']
            print(f"✅ Job dibuat! Job ID: {job_id}")
            return job_id
        else:
            raise RuntimeError("Gagal mendapatkan job ID dari event")

    def wait_for_job_completion(self, job_id: int, timeout: int = 300) -> dict:
        """
        Tunggu sampai job selesai (COMPLETED atau CANCELLED).
        Berguna untuk demo atau testing.

        Return: {'status': 'COMPLETED'/'CANCELLED', 'quality_score': int}
        """
        STATUS_MAP = {0: 'CREATED', 1: 'ACCEPTED', 2: 'VERIFYING', 3: 'COMPLETED', 4: 'CANCELLED'}
        print(f"\n⏳ Menunggu job {job_id} selesai...")

        start = time.time()
        while time.time() - start < timeout:
            job_data = self._get_job_data(job_id)
            status_num = job_data['status']
            status_str = STATUS_MAP.get(status_num, 'UNKNOWN')

            print(f"   Status: {status_str}")

            if status_num == 3:  # COMPLETED
                return {'status': 'COMPLETED', 'quality_score': job_data.get('quality_score', 0)}
            elif status_num == 4:  # CANCELLED
                return {'status': 'CANCELLED', 'quality_score': job_data.get('quality_score', 0)}

            time.sleep(5)

        return {'status': 'TIMEOUT', 'quality_score': 0}

    # ==========================================================================
    # BAGIAN 4: INTERNAL HELPERS
    # ==========================================================================

    def _accept_job(self, job_id: int):
        print(f"   ✋ Accepting job {job_id}...")
        transaction = self.escrow.functions.acceptJob(job_id).build_transaction({
            'from': self.account.address,
            'chainId': self.w3.eth.chain_id,
            'gasPrice': self.w3.eth.gas_price,
        })
        send_transaction(self.w3, self.account, transaction)

    def _submit_result(self, job_id: int, result: str):
        """
        Submit hasil pekerjaan — Chainlink Functions akan otomatis dipanggil
        untuk verifikasi kualitas. Tidak perlu hash seperti v1!
        """
        print(f"   📤 Submitting hasil job {job_id}...")
        print(f"   Panjang hasil: {len(result)} karakter")
        print(f"   Status akan berubah ke VERIFYING (Chainlink Functions sedang verifikasi)...")

        transaction = self.escrow.functions.submitResult(job_id, result).build_transaction({
            'from': self.account.address,
            'chainId': self.w3.eth.chain_id,
            'gasPrice': self.w3.eth.gas_price,
        })
        send_transaction(self.w3, self.account, transaction)
        print(f"   ✅ Submitted! Menunggu Chainlink DON verifikasi kualitas...")

    def _get_job_data(self, job_id: int) -> dict:
        job = self.escrow.functions.jobs(job_id).call()
        return {
            'job_id': job[0],
            'client': job[1],
            'provider': job[2],
            'registry_agent_id': job[3],
            'payment': job[4],
            'payment_eth': from_wei(job[4]),
            'payment_token': 'ETH' if job[5] == 0 else 'USDC',
            'result_data': job[6],
            'description': job[7],
            'job_type': job[8],
            'status': job[9],
            'deadline': job[11],
            'quality_score': job[13],
        }

    # ==========================================================================
    # BAGIAN 5: UTILITY
    # ==========================================================================

    def get_agent_info(self, agent_id: int) -> dict:
        if not self.registry:
            raise RuntimeError("Registry contract belum diset!")
        owner    = self.registry.functions.getAgentOwnerAddr(agent_id).call()
        is_active = self.registry.functions.isAgentActive(agent_id).call()
        price    = self.registry.functions.getAgentPrice(agent_id).call()
        skills   = self.registry.functions.getAgentSkills(agent_id).call()
        erc8004_id = self.registry.functions.legacyToErc8004Id(agent_id).call()
        rep_avg, rep_total = self.registry.functions.getReputation(erc8004_id).call()

        return {
            'owner': owner,
            'is_active': is_active,
            'price_usd': f"${price/100:.2f}",
            'skills': skills,
            'erc8004_id': f"0x{erc8004_id.hex()}",
            'reputation': rep_avg,
            'total_feedback': rep_total,
        }

    def get_balance(self) -> float:
        balance_wei = self.w3.eth.get_balance(self.account.address)
        balance_eth = from_wei(balance_wei)
        print(f"💰 Balance: {balance_eth} ETH")
        return balance_eth
