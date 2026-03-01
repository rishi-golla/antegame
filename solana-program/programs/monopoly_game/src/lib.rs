use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::Instruction,
    rent::Rent,
    sysvar::instructions::{self, load_instruction_at_checked},
};

declare_id!("8HvezzN7yPPPNri1pjPzsM79YtevVFGwV66FWNsaoP1U");

mod ed25519_program {
    anchor_lang::declare_id!("Ed25519SigVerify111111111111111111111111111");
}

pub const MAX_PLAYERS: usize = 6;
pub const FEE_BPS_DEFAULT: u16 = 500; // 5%
pub const EMERGENCY_CANCEL_DELAY: i64 = 86400; // 24 hours

#[program]
pub mod monopoly_game {
    use super::*;

    /// One-time initialization of the global config singleton.
    pub fn initialize(
        ctx: Context<Initialize>,
        game_signer: Pubkey,
        fee_vault: Pubkey,
        fee_bps: u16,
    ) -> Result<()> {
        require!(fee_bps <= 10000, MonopolyError::InvalidFeeBps);
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.game_signer = game_signer;
        config.fee_vault = fee_vault;
        config.fee_bps = fee_bps;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    /// Host creates a new game and deposits the buy-in.
    pub fn create_game(
        ctx: Context<CreateGame>,
        game_id: [u8; 32],
        max_players: u8,
        buy_in: u64,
    ) -> Result<()> {
        require!(max_players >= 2 && max_players <= MAX_PLAYERS as u8, MonopolyError::InvalidMaxPlayers);
        require!(buy_in > 0, MonopolyError::InvalidBuyIn);

        let game = &mut ctx.accounts.game;
        game.game_id = game_id;
        game.buy_in = buy_in;
        game.max_players = max_players;
        game.pot = buy_in;
        game.started_at = Clock::get()?.unix_timestamp;
        game.state = GameState::Waiting;
        game.players = vec![ctx.accounts.host.key()];
        game.deposited = [false; MAX_PLAYERS];
        game.deposited[0] = true;
        game.refunded = [false; MAX_PLAYERS];
        game.winner = Pubkey::default();
        game.bump = ctx.bumps.game;

        // Transfer buy-in from host to game PDA
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.host.to_account_info(),
                    to: ctx.accounts.game.to_account_info(),
                },
            ),
            buy_in,
        )?;

        Ok(())
    }

    /// Player joins an existing game and deposits the exact buy-in.
    pub fn join_game(ctx: Context<JoinGame>) -> Result<()> {
        let game = &mut ctx.accounts.game;

        require!(game.state == GameState::Waiting, MonopolyError::GameNotWaiting);
        require!(
            (game.players.len() as u8) < game.max_players,
            MonopolyError::GameFull
        );

        let player_key = ctx.accounts.player.key();

        // Prevent double-join
        require!(
            !game.players.contains(&player_key),
            MonopolyError::AlreadyJoined
        );

        let idx = game.players.len();
        let buy_in = game.buy_in;
        game.players.push(player_key);
        game.deposited[idx] = true;
        game.pot = game.pot.checked_add(buy_in).ok_or(MonopolyError::Overflow)?;

        // Transfer buy-in from player to game PDA
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.player.to_account_info(),
                    to: ctx.accounts.game.to_account_info(),
                },
            ),
            buy_in,
        )?;

        Ok(())
    }

    /// Winner claims the pot. Requires Ed25519 precompile verification via ix sysvar.
    /// Message format: game_id (32) || winner_pubkey (32) || nonce (32) || program_id (32)
    pub fn claim_winnings(ctx: Context<ClaimWinnings>, nonce: [u8; 32]) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let config = &ctx.accounts.config;

        require!(
            game.state == GameState::Waiting || game.state == GameState::Active,
            MonopolyError::GameAlreadySettled
        );

        // Require at least 2 players for settlement (defense-in-depth)
        require!(
            game.players.len() >= 2,
            MonopolyError::InsufficientPlayers
        );

        // Winner must be a player in the game
        let winner_key = ctx.accounts.winner.key();
        require!(
            game.players.contains(&winner_key),
            MonopolyError::NotAPlayer
        );

        // Verify Ed25519 signature via instruction sysvar
        verify_ed25519_signature(
            &ctx.accounts.ix_sysvar,
            &config.game_signer,
            &build_settlement_message(
                &game.game_id,
                &winner_key,
                &nonce,
                &crate::ID,
            ),
        )?;

        // Consume nonce (prevent replay)
        let nonce_account = &mut ctx.accounts.nonce_account;
        nonce_account.consumed = true;

        // Use actual PDA lamport balance for payout (not game.pot which may drift)
        let game_lamports = game.to_account_info().lamports();
        let rent = Rent::get()?.minimum_balance(GameAccount::SIZE);
        let available = game_lamports.saturating_sub(rent);

        // Calculate fee and payout from available balance
        let fee = (available as u128)
            .checked_mul(config.fee_bps as u128)
            .ok_or(MonopolyError::Overflow)?
            .checked_div(10000)
            .ok_or(MonopolyError::Overflow)? as u64;
        let payout = available.checked_sub(fee).ok_or(MonopolyError::Overflow)?;

        game.state = GameState::Settled;
        game.winner = winner_key;

        // Transfer fee to vault
        if fee > 0 {
            **game.to_account_info().try_borrow_mut_lamports()? -= fee;
            **ctx.accounts.fee_vault.try_borrow_mut_lamports()? += fee;
        }

        // Transfer payout to winner
        **game.to_account_info().try_borrow_mut_lamports()? -= payout;
        **ctx.accounts.winner.try_borrow_mut_lamports()? += payout;

        Ok(())
    }

    /// Cancel a game. Requires Ed25519 precompile verification.
    /// Message format: "CANCEL" (6) || game_id (32) || nonce (32) || program_id (32)
    pub fn cancel_game(ctx: Context<CancelGame>, nonce: [u8; 32]) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let config = &ctx.accounts.config;

        require!(
            game.state == GameState::Waiting || game.state == GameState::Active,
            MonopolyError::GameAlreadySettled
        );

        // Verify Ed25519 signature
        verify_ed25519_signature(
            &ctx.accounts.ix_sysvar,
            &config.game_signer,
            &build_cancellation_message(&game.game_id, &nonce, &crate::ID),
        )?;

        // Consume nonce
        let nonce_account = &mut ctx.accounts.nonce_account;
        nonce_account.consumed = true;
        game.state = GameState::Cancelled;

        Ok(())
    }

    /// Claim refund from a cancelled game.
    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        let game = &mut ctx.accounts.game;

        require!(game.state == GameState::Cancelled, MonopolyError::GameNotCancelled);

        let player_key = ctx.accounts.player.key();
        let idx = game
            .players
            .iter()
            .position(|p| *p == player_key)
            .ok_or(MonopolyError::NotAPlayer)?;

        require!(game.deposited[idx], MonopolyError::NotDeposited);
        require!(!game.refunded[idx], MonopolyError::AlreadyRefunded);

        game.refunded[idx] = true;

        // Transfer buy-in back to player from game PDA
        **game.to_account_info().try_borrow_mut_lamports()? -= game.buy_in;
        **ctx.accounts.player.try_borrow_mut_lamports()? += game.buy_in;

        Ok(())
    }

    /// Emergency cancel -- any player can call after 24 hours, no signature needed.
    pub fn emergency_cancel(ctx: Context<EmergencyCancel>) -> Result<()> {
        let game = &mut ctx.accounts.game;

        require!(
            game.state == GameState::Waiting || game.state == GameState::Active,
            MonopolyError::GameAlreadySettled
        );

        // Must be a player in the game
        require!(
            game.players.contains(&ctx.accounts.player.key()),
            MonopolyError::NotAPlayer
        );

        // Must be at least 24 hours since game creation
        let now = Clock::get()?.unix_timestamp;
        require!(
            now - game.started_at >= EMERGENCY_CANCEL_DELAY,
            MonopolyError::EmergencyCancelTooEarly
        );

        game.state = GameState::Cancelled;

        Ok(())
    }
}

// --- Account Structures ---

#[account]
pub struct GlobalConfig {
    pub authority: Pubkey,
    pub game_signer: Pubkey,
    pub fee_vault: Pubkey,
    pub fee_bps: u16,
    pub bump: u8,
}

impl GlobalConfig {
    pub const SIZE: usize = 8 + 32 + 32 + 32 + 2 + 1; // discriminator + fields
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum GameState {
    Waiting,
    Active,
    Settled,
    Cancelled,
}

#[account]
pub struct GameAccount {
    pub game_id: [u8; 32],
    pub buy_in: u64,
    pub max_players: u8,
    pub pot: u64,
    pub started_at: i64,
    pub state: GameState,
    pub players: Vec<Pubkey>,
    pub deposited: [bool; MAX_PLAYERS],
    pub refunded: [bool; MAX_PLAYERS],
    pub winner: Pubkey,
    pub bump: u8,
}

impl GameAccount {
    // 8 (discriminator) + 32 + 8 + 1 + 8 + 8 + 1 (enum) + 4 + (32 * 6) + 6 + 6 + 32 + 1
    pub const SIZE: usize = 8 + 32 + 8 + 1 + 8 + 8 + 1 + 4 + (32 * MAX_PLAYERS) + MAX_PLAYERS + MAX_PLAYERS + 32 + 1;
}

#[account]
pub struct NonceAccount {
    pub consumed: bool,
}

impl NonceAccount {
    pub const SIZE: usize = 8 + 1; // discriminator + consumed flag
}

// --- Instruction Contexts ---

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = GlobalConfig::SIZE,
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(game_id: [u8; 32], max_players: u8, buy_in: u64)]
pub struct CreateGame<'info> {
    #[account(
        init,
        payer = host,
        space = GameAccount::SIZE,
        seeds = [b"game", game_id.as_ref()],
        bump,
    )]
    pub game: Account<'info, GameAccount>,
    #[account(mut)]
    pub host: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinGame<'info> {
    #[account(
        mut,
        seeds = [b"game", game.game_id.as_ref()],
        bump = game.bump,
    )]
    pub game: Account<'info, GameAccount>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(nonce: [u8; 32])]
pub struct ClaimWinnings<'info> {
    #[account(
        mut,
        seeds = [b"game", game.game_id.as_ref()],
        bump = game.bump,
    )]
    pub game: Account<'info, GameAccount>,
    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, GlobalConfig>,
    /// CHECK: Winner receives lamports
    #[account(mut)]
    pub winner: AccountInfo<'info>,
    /// CHECK: Fee vault receives lamports
    #[account(
        mut,
        constraint = fee_vault.key() == config.fee_vault @ MonopolyError::InvalidFeeVault,
    )]
    pub fee_vault: AccountInfo<'info>,
    #[account(
        init,
        payer = payer,
        space = NonceAccount::SIZE,
        seeds = [b"nonce", nonce.as_ref()],
        bump,
    )]
    pub nonce_account: Account<'info, NonceAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: Instructions sysvar for Ed25519 verification
    #[account(address = instructions::ID)]
    pub ix_sysvar: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(nonce: [u8; 32])]
pub struct CancelGame<'info> {
    #[account(
        mut,
        seeds = [b"game", game.game_id.as_ref()],
        bump = game.bump,
    )]
    pub game: Account<'info, GameAccount>,
    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, GlobalConfig>,
    #[account(
        init,
        payer = payer,
        space = NonceAccount::SIZE,
        seeds = [b"nonce", nonce.as_ref()],
        bump,
    )]
    pub nonce_account: Account<'info, NonceAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: Instructions sysvar for Ed25519 verification
    #[account(address = instructions::ID)]
    pub ix_sysvar: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    #[account(
        mut,
        seeds = [b"game", game.game_id.as_ref()],
        bump = game.bump,
    )]
    pub game: Account<'info, GameAccount>,
    /// CHECK: Player receives refund lamports
    #[account(mut)]
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct EmergencyCancel<'info> {
    #[account(
        mut,
        seeds = [b"game", game.game_id.as_ref()],
        bump = game.bump,
    )]
    pub game: Account<'info, GameAccount>,
    pub player: Signer<'info>,
}

// --- Helpers ---

fn build_settlement_message(
    game_id: &[u8; 32],
    winner: &Pubkey,
    nonce: &[u8; 32],
    program_id: &Pubkey,
) -> Vec<u8> {
    let mut msg = Vec::with_capacity(128);
    msg.extend_from_slice(game_id);
    msg.extend_from_slice(winner.as_ref());
    msg.extend_from_slice(nonce);
    msg.extend_from_slice(program_id.as_ref());
    msg
}

fn build_cancellation_message(
    game_id: &[u8; 32],
    nonce: &[u8; 32],
    program_id: &Pubkey,
) -> Vec<u8> {
    let mut msg = Vec::with_capacity(102);
    msg.extend_from_slice(b"CANCEL");
    msg.extend_from_slice(game_id);
    msg.extend_from_slice(nonce);
    msg.extend_from_slice(program_id.as_ref());
    msg
}

/// Verify that the previous instruction in the transaction is a valid Ed25519
/// precompile instruction that verified the expected message with the expected signer.
fn verify_ed25519_signature(
    ix_sysvar: &AccountInfo,
    expected_signer: &Pubkey,
    expected_message: &[u8],
) -> Result<()> {
    // Search through all instructions in the transaction to find the Ed25519 precompile.
    // Wallets (e.g. Phantom) may prepend ComputeBudget instructions, so we cannot
    // assume the Ed25519 instruction is at a fixed index.
    let mut ed25519_ix: Option<Instruction> = None;
    for i in 0u16..10 {
        match load_instruction_at_checked(i as usize, ix_sysvar) {
            Ok(ix) if ix.program_id == ed25519_program::ID => {
                ed25519_ix = Some(ix);
                break;
            }
            Ok(_) => continue,
            Err(_) => break,
        }
    }
    let ix = ed25519_ix.ok_or(MonopolyError::InvalidEd25519Program)?;

    // Parse the Ed25519 instruction data
    // Format: num_signatures (1) || padding (1) || signature_offset (2) || signature_ix_index (2)
    //         || public_key_offset (2) || public_key_ix_index (2) || message_data_offset (2)
    //         || message_data_size (2) || message_ix_index (2) || public_key (32) || signature (64)
    //         || message (variable)
    require!(ix.data.len() >= 16, MonopolyError::InvalidEd25519Data);

    let num_signatures = ix.data[0];
    require!(num_signatures == 1, MonopolyError::InvalidEd25519Data);

    // Parse offsets and ix_index fields from the Ed25519 instruction data
    // Format: num_sigs(1) | pad(1) | sig_offset(2) | sig_ix_index(2) |
    //         pubkey_offset(2) | pubkey_ix_index(2) | msg_offset(2) |
    //         msg_size(2) | msg_ix_index(2) | ...data...
    let sig_ix_index = u16::from_le_bytes([ix.data[4], ix.data[5]]);
    let pubkey_offset = u16::from_le_bytes([ix.data[6], ix.data[7]]) as usize;
    let pubkey_ix_index = u16::from_le_bytes([ix.data[8], ix.data[9]]);
    let msg_offset = u16::from_le_bytes([ix.data[10], ix.data[11]]) as usize;
    let msg_size = u16::from_le_bytes([ix.data[12], ix.data[13]]) as usize;
    let msg_ix_index = u16::from_le_bytes([ix.data[14], ix.data[15]]);

    // All ix_index fields MUST be 0xFFFF, meaning data is within this instruction.
    // If not 0xFFFF, an attacker could reference arbitrary instruction data to forge
    // a signature verification bypass.
    require!(
        sig_ix_index == 0xFFFF && pubkey_ix_index == 0xFFFF && msg_ix_index == 0xFFFF,
        MonopolyError::InvalidEd25519Data
    );

    // Verify public key matches expected signer
    require!(
        ix.data.len() >= pubkey_offset + 32,
        MonopolyError::InvalidEd25519Data
    );
    let ix_pubkey = &ix.data[pubkey_offset..pubkey_offset + 32];
    require!(
        ix_pubkey == expected_signer.as_ref(),
        MonopolyError::InvalidSigner
    );

    // Verify message matches expected
    require!(
        ix.data.len() >= msg_offset + msg_size,
        MonopolyError::InvalidEd25519Data
    );
    let ix_message = &ix.data[msg_offset..msg_offset + msg_size];
    require!(
        ix_message == expected_message,
        MonopolyError::InvalidMessage
    );

    Ok(())
}

// --- Errors ---

#[error_code]
pub enum MonopolyError {
    #[msg("Invalid fee basis points (must be <= 10000)")]
    InvalidFeeBps,
    #[msg("Invalid max players (must be 2-6)")]
    InvalidMaxPlayers,
    #[msg("Buy-in must be greater than 0")]
    InvalidBuyIn,
    #[msg("Game is not in Waiting state")]
    GameNotWaiting,
    #[msg("Game is full")]
    GameFull,
    #[msg("Player already joined this game")]
    AlreadyJoined,
    #[msg("Game is already settled or cancelled")]
    GameAlreadySettled,
    #[msg("Game is not cancelled")]
    GameNotCancelled,
    #[msg("Not a player in this game")]
    NotAPlayer,
    #[msg("Player did not deposit")]
    NotDeposited,
    #[msg("Player already refunded")]
    AlreadyRefunded,
    #[msg("Emergency cancel too early (must wait 24 hours)")]
    EmergencyCancelTooEarly,
    #[msg("Missing Ed25519 precompile instruction")]
    MissingEd25519Instruction,
    #[msg("Invalid Ed25519 program")]
    InvalidEd25519Program,
    #[msg("Invalid Ed25519 instruction data")]
    InvalidEd25519Data,
    #[msg("Invalid signer in Ed25519 instruction")]
    InvalidSigner,
    #[msg("Invalid message in Ed25519 instruction")]
    InvalidMessage,
    #[msg("Invalid fee vault")]
    InvalidFeeVault,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Need at least 2 players for settlement")]
    InsufficientPlayers,
}
