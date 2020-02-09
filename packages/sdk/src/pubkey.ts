import { Secp256k1 } from "@iov/crypto";
import { Bech32, Encoding } from "@iov/encoding";
import equal from "fast-deep-equal";

import { Bech32PubKey, PubKey, pubkeyType } from "./types";

export function encodeSecp256k1Pubkey(pubkey: Uint8Array): PubKey {
  return {
    type: pubkeyType.secp256k1,
    value: Encoding.toBase64(Secp256k1.compressPubkey(pubkey)),
  };
}

export type CosmosPubkeyBech32Prefix = "cosmospub" | "cosmosvalconspub" | "cosmosvaloperpub";
const validPubkeyPrefixes = ["cosmospub", "cosmosvalconspub", "cosmosvaloperpub"];

function isCosmosPubkeyBech32Prefix(prefix: string): prefix is CosmosPubkeyBech32Prefix {
  return validPubkeyPrefixes.includes(prefix);
}

// As discussed in https://github.com/binance-chain/javascript-sdk/issues/163
// Prefixes listed here: https://github.com/tendermint/tendermint/blob/d419fffe18531317c28c29a292ad7d253f6cafdf/docs/spec/blockchain/encoding.md#public-key-cryptography
// Last bytes is varint-encoded length prefix
const pubkeyAminoPrefixSecp256k1 = Encoding.fromHex("eb5ae98721");
const pubkeyAminoPrefixEd25519 = Encoding.fromHex("1624de6420");
const pubkeyAminoPrefixSr25519 = Encoding.fromHex("0dfb1005");
const pubkeyAminoPrefixLength = pubkeyAminoPrefixSecp256k1.length;

export function decodeBech32Pubkey(bech: Bech32PubKey): PubKey {
  const { prefix, data } = Bech32.decode(bech);
  if (!isCosmosPubkeyBech32Prefix(prefix)) {
    throw new Error(`Invalid bech32 prefix. Must be one of ${validPubkeyPrefixes.join(", ")}.`);
  }

  const aminoPrefix = data.slice(0, pubkeyAminoPrefixLength);
  const rest = data.slice(pubkeyAminoPrefixLength);
  if (equal(aminoPrefix, pubkeyAminoPrefixSecp256k1)) {
    if (rest.length !== 33) {
      throw new Error("Invalid rest data length. Expected 33 bytes (compressed secp256k1 pubkey).");
    }
    return {
      type: pubkeyType.secp256k1,
      value: Encoding.toBase64(rest),
    };
  } else if (equal(aminoPrefix, pubkeyAminoPrefixEd25519)) {
    if (rest.length !== 32) {
      throw new Error("Invalid rest data length. Expected 32 bytes (Ed25519 pubkey).");
    }
    return {
      type: pubkeyType.ed25519,
      value: Encoding.toBase64(rest),
    };
  } else if (equal(aminoPrefix, pubkeyAminoPrefixSr25519)) {
    if (rest.length !== 32) {
      throw new Error("Invalid rest data length. Expected 32 bytes (Sr25519 pubkey).");
    }
    return {
      type: pubkeyType.sr25519,
      value: Encoding.toBase64(rest),
    };
  } else {
    throw new Error("Unsupported Pubkey type. Amino prefix: " + Encoding.toHex(aminoPrefix));
  }
}

export function encodeBech32Pubkey(pubkey: PubKey, prefix: CosmosPubkeyBech32Prefix): Bech32PubKey {
  let aminoPrefix: Uint8Array;
  switch (pubkey.type) {
    // Note: please don't add cases here without writing additional unit tests
    case pubkeyType.secp256k1:
      aminoPrefix = pubkeyAminoPrefixSecp256k1;
      break;
    default:
      throw new Error("Unsupported pubkey type");
  }

  const data = new Uint8Array([...aminoPrefix, ...Encoding.fromBase64(pubkey.value)]);
  return Bech32.encode(prefix, data);
}
