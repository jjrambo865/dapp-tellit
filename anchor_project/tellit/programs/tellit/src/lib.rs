use anchor_lang::prelude::*;

declare_id!("BnT3T9mtNjXBEELoggRSQYN5gJhAb3Rvut3sH8mrMP6J");





#[program]
pub mod tellit {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.bump = ctx.bumps.config;
        config.note_count = 0;
        Ok(())
    }



    // Old edit_note function removed - using edit_note_by_content instead

    // Old react_to_note function removed - using react_to_note_by_content instead

    // Old remove_reaction and change_reaction functions removed - not needed for core functionality

    // Old delete_note function removed - using delete_note_by_content instead

    // New backend-only functions that take raw inputs and handle all PDA generation internally
    
    pub fn send_note_by_content(
        ctx: Context<SendNoteByContent>,
        title: String,
        content: String,
    ) -> Result<()> {
        require!(
            ctx.accounts.author.key() != ctx.accounts.receiver.key(),
            TellitError::CannotSendToSelf
        );
        require!(title.len() <= 50, TellitError::TitleTooLong);
        require!(content.len() <= 300, TellitError::ContentTooLong);
        
        // Duplicate detection is handled by PDA uniqueness - if same PDA exists, account creation fails

        // Use references to avoid moving large strings
        let note = &mut ctx.accounts.note;
        let config = &mut ctx.accounts.config;
        let current_time = Clock::get()?.unix_timestamp;

        note.author = ctx.accounts.author.key();
        note.receiver = ctx.accounts.receiver.key();
        note.title = title;
        note.content = content;
        note.bump = ctx.bumps.note;
        note.likes = 0;
        note.dislikes = 0;
        note.created_at = current_time;
        note.updated_at = current_time;

        config.note_count = config.note_count.saturating_add(1);
        Ok(())
    }
    
    // Edit note functionality removed - keeping app simple

    pub fn delete_note_by_content(
        ctx: Context<DeleteNoteByContent>,
        _original_title: String,
        _original_content: String,
    ) -> Result<()> {
        let deleter = ctx.accounts.deleter.key();
        let note = &ctx.accounts.note;
        let config = &mut ctx.accounts.config;

        require!(
            deleter == note.author || deleter == note.receiver,
            TellitError::NotAuthorized
        );

        config.note_count = config.note_count.saturating_sub(1);
        Ok(())
    }

    pub fn react_to_note_by_content(
        ctx: Context<ReactToNoteByContent>,
        _original_title: String,
        _original_content: String,
        reaction_type: ReactionType,
    ) -> Result<()> {
        let note = &mut ctx.accounts.note;
        let reaction = &mut ctx.accounts.reaction;
        let reactor = ctx.accounts.reactor.key();

        // Add new reaction
        match reaction_type {
            ReactionType::Like => {
                note.likes = note.likes.saturating_add(1);
            }
            ReactionType::Dislike => {
                note.dislikes = note.dislikes.saturating_add(1);
            }
            ReactionType::None => {
                // No reaction - this shouldn't happen in normal flow
                return Err(TellitError::InvalidReactionType.into());
            }
        }

        reaction.note = note.key();
        reaction.reactor = reactor;
        reaction.reaction_type = reaction_type;
        reaction.bump = ctx.bumps.reaction;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + 32 + 1 + 8, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}



// Old EditNote struct removed

// Old ReactToNote struct removed

// Old RemoveReaction, ChangeReaction, and DeleteNote structs removed

#[account]
pub struct Config {
    pub authority: Pubkey,
    pub bump: u8,
    pub note_count: u64,
}

#[account]
pub struct Note {
    pub author: Pubkey,
    pub receiver: Pubkey,
    pub title: String,
    pub content: String,
    pub bump: u8,
    pub likes: u64,
    pub dislikes: u64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[account]
pub struct Reaction {
    pub reactor: Pubkey,
    pub note: Pubkey,
    pub reaction_type: ReactionType,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ReactionType {
    None,
    Like,
    Dislike,
}

// New backend-only structs that handle PDA generation internally
#[derive(Accounts)]
#[instruction(title: String, content: String)]
pub struct SendNoteByContent<'info> {
    /// CHECK: This account is derived using the seeds and will be created by the program
    #[account(
        init,
        payer = author,
        space = 8 + 32 + 32 + 4 + 50 + 4 + 300 + 1 + 8 + 8 + 8 + 8,
        seeds = [b"note", author.key().as_ref(), receiver.key().as_ref(), &anchor_lang::solana_program::keccak::hash(&format!("{}{}", title, content).as_bytes()).to_bytes()],
        bump
    )]
    pub note: Account<'info, Note>,
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub author: Signer<'info>,
    /// CHECK: This is the receiver of the note
    pub receiver: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}
// EditNoteByContent struct removed - keeping app simple

#[derive(Accounts)]
#[instruction(original_title: String, original_content: String)]
pub struct DeleteNoteByContent<'info> {
    #[account(
        mut,
        close = deleter,
        constraint = deleter.key() == note.author || deleter.key() == note.receiver @ TellitError::NotAuthorized,
        seeds = [b"note", note.author.as_ref(), note.receiver.as_ref(), &anchor_lang::solana_program::keccak::hash(&format!("{}{}", original_title, original_content).as_bytes()).to_bytes()],
        bump = note.bump
    )]
    pub note: Account<'info, Note>,
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub deleter: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(original_title: String, original_content: String)]
pub struct ReactToNoteByContent<'info> {
    #[account(
        mut,
        seeds = [b"note", note.author.as_ref(), note.receiver.as_ref(), &anchor_lang::solana_program::keccak::hash(&format!("{}{}", original_title, original_content).as_bytes()).to_bytes()],
        bump = note.bump
    )]
    pub note: Account<'info, Note>,
    #[account(init, payer = reactor, space = 8 + 32 + 32 + 1 + 1, seeds = [b"reaction", note.key().as_ref(), reactor.key().as_ref()], bump)]
    pub reaction: Account<'info, Reaction>,
    #[account(mut)]
    pub reactor: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum TellitError {
    #[msg("Cannot send note to yourself")]
    CannotSendToSelf,
    #[msg("Title is too long (max 50 characters)")]
    TitleTooLong,
    #[msg("Content is too long (max 300 characters)")]
    ContentTooLong,
    #[msg("Duplicate message - note already exists")]
    DuplicateMessage,

    #[msg("Not authorized to perform this action")]
    NotAuthorized,
    #[msg("Invalid reaction type")]
    InvalidReactionType,
}