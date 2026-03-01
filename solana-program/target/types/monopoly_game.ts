/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/monopoly_game.json`.
 */
export type MonopolyGame = {
  "address": "8HvezzN7yPPPNri1pjPzsM79YtevVFGwV66FWNsaoP1U",
  "metadata": {
    "name": "monopolyGame",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Trustless Monopoly game escrow on Solana"
  },
  "instructions": [
    {
      "name": "cancelGame",
      "docs": [
        "Cancel a game. Requires Ed25519 precompile verification.",
        "Message format: \"CANCEL\" (6) || game_id (32) || nonce (32) || program_id (32)"
      ],
      "discriminator": [
        121,
        194,
        154,
        118,
        103,
        235,
        149,
        52
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.game_id",
                "account": "gameAccount"
              }
            ]
          }
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "nonceAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  111,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "nonce"
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "ixSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "nonce",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "claimRefund",
      "docs": [
        "Claim refund from a cancelled game."
      ],
      "discriminator": [
        15,
        16,
        30,
        161,
        255,
        228,
        97,
        60
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.game_id",
                "account": "gameAccount"
              }
            ]
          }
        },
        {
          "name": "player",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "claimWinnings",
      "docs": [
        "Winner claims the pot. Requires Ed25519 precompile verification via ix sysvar.",
        "Message format: game_id (32) || winner_pubkey (32) || nonce (32) || program_id (32)"
      ],
      "discriminator": [
        161,
        215,
        24,
        59,
        14,
        236,
        242,
        221
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.game_id",
                "account": "gameAccount"
              }
            ]
          }
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "winner",
          "writable": true
        },
        {
          "name": "feeVault",
          "writable": true
        },
        {
          "name": "nonceAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  111,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "nonce"
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "ixSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "nonce",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "createGame",
      "docs": [
        "Host creates a new game and deposits the buy-in."
      ],
      "discriminator": [
        124,
        69,
        75,
        66,
        184,
        220,
        72,
        206
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "gameId"
              }
            ]
          }
        },
        {
          "name": "host",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "gameId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "maxPlayers",
          "type": "u8"
        },
        {
          "name": "buyIn",
          "type": "u64"
        }
      ]
    },
    {
      "name": "emergencyCancel",
      "docs": [
        "Emergency cancel -- any player can call after 24 hours, no signature needed."
      ],
      "discriminator": [
        92,
        73,
        255,
        17,
        197,
        5,
        46,
        75
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.game_id",
                "account": "gameAccount"
              }
            ]
          }
        },
        {
          "name": "player",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "initialize",
      "docs": [
        "One-time initialization of the global config singleton."
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "gameSigner",
          "type": "pubkey"
        },
        {
          "name": "feeVault",
          "type": "pubkey"
        },
        {
          "name": "feeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "joinGame",
      "docs": [
        "Player joins an existing game and deposits the exact buy-in."
      ],
      "discriminator": [
        107,
        112,
        18,
        38,
        56,
        173,
        60,
        128
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.game_id",
                "account": "gameAccount"
              }
            ]
          }
        },
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "gameAccount",
      "discriminator": [
        168,
        26,
        58,
        96,
        13,
        208,
        230,
        188
      ]
    },
    {
      "name": "globalConfig",
      "discriminator": [
        149,
        8,
        156,
        202,
        160,
        252,
        176,
        217
      ]
    },
    {
      "name": "nonceAccount",
      "discriminator": [
        110,
        202,
        133,
        201,
        147,
        206,
        238,
        84
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidFeeBps",
      "msg": "Invalid fee basis points (must be <= 10000)"
    },
    {
      "code": 6001,
      "name": "invalidMaxPlayers",
      "msg": "Invalid max players (must be 2-6)"
    },
    {
      "code": 6002,
      "name": "invalidBuyIn",
      "msg": "Buy-in must be greater than 0"
    },
    {
      "code": 6003,
      "name": "gameNotWaiting",
      "msg": "Game is not in Waiting state"
    },
    {
      "code": 6004,
      "name": "gameFull",
      "msg": "Game is full"
    },
    {
      "code": 6005,
      "name": "alreadyJoined",
      "msg": "Player already joined this game"
    },
    {
      "code": 6006,
      "name": "gameAlreadySettled",
      "msg": "Game is already settled or cancelled"
    },
    {
      "code": 6007,
      "name": "gameNotCancelled",
      "msg": "Game is not cancelled"
    },
    {
      "code": 6008,
      "name": "notAPlayer",
      "msg": "Not a player in this game"
    },
    {
      "code": 6009,
      "name": "notDeposited",
      "msg": "Player did not deposit"
    },
    {
      "code": 6010,
      "name": "alreadyRefunded",
      "msg": "Player already refunded"
    },
    {
      "code": 6011,
      "name": "emergencyCancelTooEarly",
      "msg": "Emergency cancel too early (must wait 24 hours)"
    },
    {
      "code": 6012,
      "name": "missingEd25519Instruction",
      "msg": "Missing Ed25519 precompile instruction"
    },
    {
      "code": 6013,
      "name": "invalidEd25519Program",
      "msg": "Invalid Ed25519 program"
    },
    {
      "code": 6014,
      "name": "invalidEd25519Data",
      "msg": "Invalid Ed25519 instruction data"
    },
    {
      "code": 6015,
      "name": "invalidSigner",
      "msg": "Invalid signer in Ed25519 instruction"
    },
    {
      "code": 6016,
      "name": "invalidMessage",
      "msg": "Invalid message in Ed25519 instruction"
    },
    {
      "code": 6017,
      "name": "invalidFeeVault",
      "msg": "Invalid fee vault"
    },
    {
      "code": 6018,
      "name": "overflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6019,
      "name": "insufficientPlayers",
      "msg": "Need at least 2 players for settlement"
    }
  ],
  "types": [
    {
      "name": "gameAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "gameId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "buyIn",
            "type": "u64"
          },
          {
            "name": "maxPlayers",
            "type": "u8"
          },
          {
            "name": "pot",
            "type": "u64"
          },
          {
            "name": "startedAt",
            "type": "i64"
          },
          {
            "name": "state",
            "type": {
              "defined": {
                "name": "gameState"
              }
            }
          },
          {
            "name": "players",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "deposited",
            "type": {
              "array": [
                "bool",
                6
              ]
            }
          },
          {
            "name": "refunded",
            "type": {
              "array": [
                "bool",
                6
              ]
            }
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "gameState",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "waiting"
          },
          {
            "name": "active"
          },
          {
            "name": "settled"
          },
          {
            "name": "cancelled"
          }
        ]
      }
    },
    {
      "name": "globalConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "gameSigner",
            "type": "pubkey"
          },
          {
            "name": "feeVault",
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "nonceAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "consumed",
            "type": "bool"
          }
        ]
      }
    }
  ]
};
