import { createConfig, http } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { injected, coinbaseWallet } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [arbitrumSepolia],
  ssr: true,
  connectors: [
    injected(),                               // MetaMask, Rabby, any injected wallet
    coinbaseWallet({ appName: "NeuroCart" }), // Coinbase Wallet
  ],
  transports: {
    [arbitrumSepolia.id]: http("https://sepolia-rollup.arbitrum.io/rpc"),
  },
});
