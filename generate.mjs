#!/usr/bin/env node
/**
 * generate-keys.mjs (append-only, safe)
 *
 * Flags:
 *  --count=N               : jumlah akun per mnemonic (default 5)
 *  --mnemonic-count=M      : jumlah mnemonic yang dibuat (default 1)
 *  --only-mnemonic         : hanya tulis mnemonic (tidak tulis private keys)
 *  --only-private          : hanya tulis private keys (mnemonic dibuat internal, TIDAK ditulis)
 *  --out-mnemonic=PATH     : path file mnemonic (default ./generate/mnemonic.txt)
 *  --out-private=PATH      : path file private keys (default ./generate/privatekeys.txt)
 *
 * Catatan:
 *  - SELALU append. Tidak pernah menghapus isi file lama.
 *  - Jika folder tujuan belum ada, akan dibuat otomatis.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// parse arg sederhana
const argv = new Map(process.argv.slice(2).map(s => {
  const m = s.match(/^--([^=]+)(=(.*))?$/);
  return m ? [m[1], m[3] ?? "1"] : [s, "1"];
}));

const COUNT = Math.max(1, Number(argv.get("count") ?? 5));             // akun per mnemonic
const MNEMONIC_COUNT = Math.max(1, Number(argv.get("mnemonic-count") ?? 1));
const ONLY_MNEMONIC = argv.has("only-mnemonic");
const ONLY_PRIVATE  = argv.has("only-private");

// default ke folder ./generate/
const defaultOutMnemonic = path.resolve(__dirname, "mnemonic.txt");
const defaultOutPrivate  = path.resolve(__dirname, "privatekey.txt");

const OUT_MNEMONIC = path.resolve(__dirname, String(argv.get("out-mnemonic") ?? defaultOutMnemonic));
const OUT_PRIVATE  = path.resolve(__dirname, String(argv.get("out-private")  ?? defaultOutPrivate));

// derivation path prefix (BIP44 ETH)
const DERIVATION_PREFIX = `m/44'/60'/0'/0/`;

// util: pastikan folder ada, lalu append
function appendFileSyncEnsure(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, { encoding: "utf8", flag: "a" }); // APPEND SELALU
}

(async () => {
  try {
    console.log("Options:");
    console.log("  mnemonic-count     :", MNEMONIC_COUNT);
    console.log("  count per mnemonic :", COUNT);
    console.log("  only-mnemonic      :", ONLY_MNEMONIC);
    console.log("  only-private       :", ONLY_PRIVATE);
    console.log("  out-mnemonic       :", OUT_MNEMONIC);
    console.log("  out-private        :", OUT_PRIVATE);
    console.log("");

    if (ONLY_MNEMONIC && ONLY_PRIVATE) {
      console.warn("Peringatan: --only-mnemonic & --only-private dipakai bersamaan — lanjut sebagai --only-mnemonic (tidak tulis private keys).");
    }

    for (let mi = 0; mi < MNEMONIC_COUNT; mi++) {
      // buat 24 kata (32 byte entropy)
      const entropy = ethers.randomBytes(32);
      const mnemonic = ethers.Mnemonic.fromEntropy(entropy);
      const phrase = mnemonic.phrase;

      // tulis mnemonic? (append)
      if (!ONLY_PRIVATE && (!ONLY_MNEMONIC || ONLY_MNEMONIC)) {
        appendFileSyncEnsure(OUT_MNEMONIC, phrase + "\n");
      }

      if (ONLY_MNEMONIC) {
        console.log(`(${mi+1}/${MNEMONIC_COUNT}) mnemonic ditulis (append).`);
        continue;
      }

      // derive private keys
      const pkLines = [];
      for (let i = 0; i < COUNT; i++) {
        const pathI = `${DERIVATION_PREFIX}${i}`;
        const w = ethers.HDNodeWallet.fromPhrase(phrase, undefined, pathI);
        pkLines.push(w.privateKey);
      }

      // tulis private keys? (append)
      if (!ONLY_MNEMONIC) {
        appendFileSyncEnsure(OUT_PRIVATE, pkLines.join("\n") + "\n");
      }

      console.log(`(${mi+1}/${MNEMONIC_COUNT}) derived ${COUNT} private keys${ONLY_PRIVATE ? " (mnemonic TIDAK ditulis)" : ""}.`);
    }

    console.log("\n✅ Selesai (APPEND mode).");
    if (!ONLY_PRIVATE) console.log("  mnemonic file  :", OUT_MNEMONIC);
    if (!ONLY_MNEMONIC) console.log("  privatekeys file:", OUT_PRIVATE);
  } catch (e) {
    console.error("Error:", e?.message ?? e);
    process.exit(1);
  }
})();