# utils.py
# Kumpulan fungsi helper yang dipakai berulang-ulang di SDK

from web3 import Web3
import hashlib

def to_wei(amount_eth: float) -> int:
    """
    Konversi ETH ke wei.
    Contoh: to_wei(0.01) → 10000000000000000
    
    Kenapa perlu ini? Blockchain selalu kerja dalam wei,
    bukan ETH. Seperti kita kerja dalam 'sen' bukan 'rupiah'.
    """
    return Web3.to_wei(amount_eth, 'ether')

def from_wei(amount_wei: int) -> float:
    """
    Konversi wei ke ETH.
    Contoh: from_wei(10000000000000000) → 0.01
    """
    return float(Web3.from_wei(amount_wei, 'ether'))

def hash_result(result: str) -> bytes:
    """
    Buat hash dari hasil pekerjaan agent.
    
    Cara kerja:
    - result = string output dari agent, contoh: "Halo dunia ini transkripsi"
    - kita hash pakai keccak256 (algoritma hash standar Ethereum)
    - hasilnya bytes32 yang bisa disimpan di blockchain
    
    Contoh:
    hash_result("hello") → b'\\x1c\\x8a...' (32 bytes)
    """
    # encode string ke bytes dulu, lalu hash
    return Web3.solidity_keccak(['string'], [result])

def hash_to_hex(hash_bytes: bytes) -> str:
    """
    Konversi bytes32 hash ke string hex yang mudah dibaca.
    Contoh: b'\\x1c\\x8a...' → '0x1c8a...'
    Berguna untuk ditampilkan ke user atau disimpan di file.
    """
    return '0x' + hash_bytes.hex()

def connect_web3(rpc_url: str) -> Web3:
    """
    Buat koneksi ke blockchain.
    rpc_url = alamat node blockchain yang kita hubungi
    
    Seperti 'membuka koneksi internet' ke jaringan Arbitrum.
    """
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    
    if not w3.is_connected():
        raise ConnectionError(f"Gagal konek ke {rpc_url}")
    
    print(f"✅ Terhubung ke blockchain! Chain ID: {w3.eth.chain_id}")
    return w3

def get_account(w3: Web3, private_key: str):
    """
    Load akun dari private key.
    
    Private key = kunci rahasia wallet kamu (JANGAN PERNAH SHARE!)
    Dari private key, kita bisa sign transaksi — artinya membuktikan
    bahwa kita adalah pemilik wallet tersebut.
    """
    # Pastikan private key ada prefix 0x
    if not private_key.startswith('0x'):
        private_key = '0x' + private_key
    
    account = w3.eth.account.from_key(private_key)
    print(f"✅ Akun loaded: {account.address}")
    return account

def send_transaction(w3: Web3, account, transaction):
    """
    Sign dan kirim transaksi ke blockchain.
    
    Flow:
    1. Estimasi gas yang dibutuhkan
    2. Sign transaksi dengan private key
    3. Broadcast ke network
    4. Tunggu konfirmasi
    5. Return receipt (bukti transaksi)
    """
    # Estimasi gas — berapa biaya komputasi yang dibutuhkan
    gas_estimate = w3.eth.estimate_gas(transaction)
    
    # Tambah 20% buffer biar tidak kehabisan gas di tengah jalan
    transaction['gas'] = int(gas_estimate * 1.2)
    
    # Ambil nonce — counter transaksi dari wallet ini
    # Setiap transaksi harus punya nonce unik yang naik terus
    transaction['nonce'] = w3.eth.get_transaction_count(account.address)
    
    # Sign transaksi — bukti bahwa kita pemilik wallet ini
    signed = account.sign_transaction(transaction)
    
    # Broadcast ke network
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    
    print(f"📤 Transaksi dikirim! Hash: {tx_hash.hex()}")
    print(f"⏳ Menunggu konfirmasi...")
    
    # Tunggu sampai transaksi masuk ke block
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    
    if receipt['status'] == 1:
        print(f"✅ Transaksi berhasil! Block: {receipt['blockNumber']}")
    else:
        print(f"❌ Transaksi gagal!")
    
    return receipt