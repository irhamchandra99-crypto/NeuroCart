# agent_sdk.py
# Class utama SDK — ini yang dipakai developer untuk:
# 1. Register agent mereka ke marketplace
# 2. Listen job yang masuk
# 3. Submit hasil dan terima pembayaran

import time
import threading
from web3 import Web3
from dotenv import load_dotenv
import os

from contracts import load_abi, CONTRACT_ADDRESSES, NETWORKS
from utils import connect_web3, get_account, send_transaction, hash_result, hash_to_hex, to_wei, from_wei

# Load variabel dari file .env
# Ini supaya private key tidak hardcode di kode — lebih aman
load_dotenv()

class AgentSDK:
    """
    SDK untuk berinteraksi dengan AI Agent Marketplace di Arbitrum.
    
    Cara pakai:
    
        sdk = AgentSDK(private_key="0x...", network="arbitrum_sepolia")
        
        agent_id = sdk.register_agent(
            name="TranscriberBot",
            skills=["transcription"],
            price_eth=0.01,
            endpoint="https://mybot.com/api"
        )
        
        sdk.listen_for_jobs(agent_id, handler=my_handler_function)
    """
    
    def __init__(self, private_key: str = None, network: str = "arbitrum_sepolia"):
        """
        Inisialisasi SDK.
        
        private_key: private key wallet kamu. 
                     Kalau None, SDK akan cari di file .env (lebih aman)
        network: jaringan yang dipakai, default arbitrum_sepolia
        """
        # Ambil private key — dari parameter atau dari .env
        # Urutan prioritas: parameter > .env file
        self.private_key = private_key or os.getenv("PRIVATE_KEY")
        
        if not self.private_key:
            raise ValueError(
                "Private key tidak ditemukan! "
                "Isi PRIVATE_KEY di file sdk/.env atau pass langsung ke constructor."
            )
        
        # Setup koneksi ke blockchain
        network_config = NETWORKS.get(network)
        if not network_config:
            raise ValueError(f"Network '{network}' tidak dikenal. Pilih: {list(NETWORKS.keys())}")
        
        self.network = network
        self.w3 = connect_web3(network_config["rpc_url"])
        self.account = get_account(self.w3, self.private_key)
        
        # Load contract addresses
        addresses = CONTRACT_ADDRESSES.get(network, {})
        
        # Load ABI dan buat contract instance
        # Contract instance = objek Python yang merepresentasikan smart contract
        # Lewat ini kita bisa panggil fungsi contract seperti memanggil method Python biasa
        registry_abi = load_abi("AgentRegistry")
        escrow_abi = load_abi("JobEscrow")
        
        registry_address = addresses.get("AgentRegistry", "")
        escrow_address = addresses.get("JobEscrow", "")
        
        # Kalau address belum diisi, contract belum di-deploy
        # Kita tetap load tapi kasih warning
        if registry_address:
            self.registry = self.w3.eth.contract(
                address=Web3.to_checksum_address(registry_address),
                abi=registry_abi
            )
        else:
            self.registry = None
            print("⚠️  AgentRegistry address belum diset di contracts.py")
        
        if escrow_address:
            self.escrow = self.w3.eth.contract(
                address=Web3.to_checksum_address(escrow_address),
                abi=escrow_abi
            )
        else:
            self.escrow = None
            print("⚠️  JobEscrow address belum diset di contracts.py")
        
        print(f"🚀 AgentSDK siap! Network: {network_config['name']}")
    
    # ==========================================
    # BAGIAN 1: REGISTER AGENT
    # ==========================================
    
    def register_agent(
        self, 
        name: str, 
        skills: list, 
        price_eth: float, 
        endpoint: str
    ) -> int:
        """
        Daftarkan AI agent ke marketplace.
        
        Parameter:
        - name: nama agent, contoh "TranscriberBot"
        - skills: list skill, contoh ["transcription", "ocr"]
        - price_eth: harga per call dalam ETH, contoh 0.01
        - endpoint: URL API agent kamu
        
        Return: agent_id (integer)
        """
        if not self.registry:
            raise RuntimeError("Registry contract belum diset!")
        
        print(f"\n📝 Mendaftarkan agent '{name}'...")
        print(f"   Skills: {skills}")
        print(f"   Harga: {price_eth} ETH per call")
        
        price_wei = to_wei(price_eth)
        
        # Build transaksi — belum dikirim, baru disiapkan
        transaction = self.registry.functions.registerAgent(
            name,
            skills,
            price_wei,
            endpoint
        ).build_transaction({
            'from': self.account.address,
            'chainId': self.w3.eth.chain_id,
            'gasPrice': self.w3.eth.gas_price,
        })
        
        # Sign dan kirim transaksi
        receipt = send_transaction(self.w3, self.account, transaction)
        
        # Ambil agent_id dari event yang di-emit contract
        # processReceipt = parse log/event dari receipt
        events = self.registry.events.AgentRegistered().process_receipt(receipt)
        
        if events:
            agent_id = events[0]['args']['agentId']
            print(f"✅ Agent terdaftar! Agent ID: {agent_id}")
            return agent_id
        else:
            raise RuntimeError("Gagal mendapatkan agent ID dari event")
    
    # ==========================================
    # BAGIAN 2: LISTEN JOB
    # ==========================================
    
    def listen_for_jobs(self, agent_id: int, handler, poll_interval: int = 5):
        """
        Pantau blockchain untuk job baru yang ditujukan ke agent ini.
        Jalankan handler function setiap kali ada job baru.
        
        Parameter:
        - agent_id: ID agent yang mau dipantau
        - handler: fungsi yang dipanggil saat ada job baru
                   handler menerima parameter: (job_id, job_data)
        - poll_interval: seberapa sering cek (detik), default 5 detik
        
        Contoh handler:
        def my_handler(job_id, job_data):
            result = do_ai_work(job_data['description'])
            return result
        """
        if not self.escrow:
            raise RuntimeError("Escrow contract belum diset!")
        
        print(f"\n👂 Mulai listen job untuk Agent ID: {agent_id}")
        print(f"   Polling setiap {poll_interval} detik...")
        print(f"   Tekan Ctrl+C untuk stop\n")
        
        # Simpan job yang sudah diproses biar tidak diproses dua kali
        processed_jobs = set()
        
        while True:
            try:
                # Cek semua job yang ada
                # Di production, ini sebaiknya pakai event filter
                # Untuk MVP, kita scan semua job
                total_jobs = self.escrow.functions.jobCount().call()
                
                for job_id in range(total_jobs):
                    if job_id in processed_jobs:
                        continue
                    
                    # Ambil data job
                    job = self.escrow.functions.jobs(job_id).call()
                    
                    # job adalah tuple, urutannya sesuai struct:
                    # (jobId, clientAgent, providerAgent, registryAgentId, 
                    #  payment, resultHash, submittedHash, status, 
                    #  createdAt, deadline, jobDescription)
                    
                    job_data = {
                        'job_id': job[0],
                        'client': job[1],
                        'provider': job[2],
                        'registry_agent_id': job[3],
                        'payment_wei': job[4],
                        'payment_eth': from_wei(job[4]),
                        'result_hash': job[5],
                        'status': job[7],  # 0=CREATED, 1=ACCEPTED, 2=COMPLETED, 3=CANCELLED
                        'deadline': job[9],
                        'description': job[10]
                    }
                    
                    # Cek apakah job ini untuk agent kita dan statusnya CREATED (0)
                    is_for_us = job_data['registry_agent_id'] == agent_id
                    is_new = job_data['status'] == 0  # CREATED
                    
                    if is_for_us and is_new:
                        print(f"🔔 Job baru ditemukan! Job ID: {job_id}")
                        print(f"   Deskripsi: {job_data['description']}")
                        print(f"   Bayaran: {job_data['payment_eth']} ETH")
                        
                        # Accept job dulu
                        self._accept_job(job_id)
                        
                        # Panggil handler function yang diberikan developer
                        # Handler ini berisi logic AI agent mereka
                        try:
                            result = handler(job_id, job_data)
                            
                            if result:
                                # Submit hasil ke blockchain
                                self._submit_result(job_id, result, job[5])
                            
                        except Exception as e:
                            print(f"❌ Error di handler: {e}")
                        
                        processed_jobs.add(job_id)
                
                # Tunggu sebelum cek lagi
                time.sleep(poll_interval)
                
            except KeyboardInterrupt:
                print("\n👋 Listen dihentikan.")
                break
            except Exception as e:
                print(f"❌ Error saat listen: {e}")
                time.sleep(poll_interval)
    
    # ==========================================
    # BAGIAN 3: ACCEPT & SUBMIT (INTERNAL)
    # ==========================================
    
    def _accept_job(self, job_id: int):
        """Accept job — konfirmasi kita mau ngerjain."""
        print(f"   ✋ Accepting job {job_id}...")
        
        transaction = self.escrow.functions.acceptJob(
            job_id
        ).build_transaction({
            'from': self.account.address,
            'chainId': self.w3.eth.chain_id,
            'gasPrice': self.w3.eth.gas_price,
        })
        
        send_transaction(self.w3, self.account, transaction)
    
    def _submit_result(self, job_id: int, result: str, agreed_hash: bytes):
        """
        Submit hasil pekerjaan ke blockchain.
        
        result: string hasil kerja agent
        agreed_hash: hash yang disepakati di awal (dari job data)
        
        Kita hash result kita, lalu bandingkan dengan agreed_hash.
        Kalau cocok → payment otomatis release.
        """
        print(f"   📤 Submitting hasil job {job_id}...")
        
        # Hash hasil pekerjaan kita
        result_hash = hash_result(result)
        
        print(f"   Hash hasil: {hash_to_hex(result_hash)}")
        print(f"   Hash target: 0x{agreed_hash.hex()}")
        
        # Cek dulu apakah hash kita cocok
        if result_hash == agreed_hash:
            print(f"   ✅ Hash cocok! Payment akan otomatis release.")
        else:
            print(f"   ⚠️  Hash tidak cocok. ETH akan dikembalikan ke client.")
        
        transaction = self.escrow.functions.submitResult(
            job_id,
            result_hash
        ).build_transaction({
            'from': self.account.address,
            'chainId': self.w3.eth.chain_id,
            'gasPrice': self.w3.eth.gas_price,
        })
        
        send_transaction(self.w3, self.account, transaction)
    
    # ==========================================
    # BAGIAN 4: UTILITY METHODS
    # ==========================================
    
    def get_agent_info(self, agent_id: int) -> dict:
        """Ambil info agent dari blockchain."""
        if not self.registry:
            raise RuntimeError("Registry contract belum diset!")
        
        agent = self.registry.functions.agents(agent_id).call()
        skills = self.registry.functions.getAgentSkills(agent_id).call()
        
        return {
            'owner': agent[0],
            'name': agent[1],
            'skills': skills,
            'price_eth': from_wei(agent[2]),
            'endpoint': agent[3],
            'is_active': agent[4],
            'reputation': agent[5],
            'total_jobs': agent[6]
        }
    
    def get_balance(self) -> float:
        """Cek balance ETH wallet kita."""
        balance_wei = self.w3.eth.get_balance(self.account.address)
        balance_eth = from_wei(balance_wei)
        print(f"💰 Balance: {balance_eth} ETH")
        return balance_eth