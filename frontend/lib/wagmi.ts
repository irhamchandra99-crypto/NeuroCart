import { createConfig, http } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { injected, coinbaseWallet } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [arbitrumSepolia],
  ssr: false, // ← FIX: matikan SSR, ini penyebab error #310
  connectors: [
    injected(),
    coinbaseWallet({ appName: "NeuroCart" }),
  ],
  transports: {
    [arbitrumSepolia.id]: http("https://sepolia-rollup.arbitrum.io/rpc"),
  },
});