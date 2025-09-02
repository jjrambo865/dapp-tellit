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

    pub fn send_note(
        ctx: Context<SendNote>,
        title: String,
        content: String,
    ) -> Result<()> {
        require!(
            ctx.accounts.author.key() != ctx.accounts.receiver.key(),
            TellitError::CannotSendToSelf
        );
        require!(title.len() <= 50, TellitError::TitleTooLong);
        require!(content.len() <= 500, TellitError::ContentTooLong);
        require!(ctx.accounts.note.author == Pubkey::default(), TellitError::NoteAlreadyExists);

        let note = &mut ctx.accounts.note;
        let config = &mut ctx.accounts.config;
        let current_time = Clock::get()?.unix_timestamp;

        note.author = ctx.accounts.author.key();
        note.receiver = ctx.accounts.receiver.key();
        note.title = title;
        note.content = content;
        note.likes = 0;
        note.dislikes = 0;
        note.created_at = current_time;
        note.updated_at = current_time;
        note.bump = ctx.bumps.note;

        config.note_count = config.note_count.saturating_add(1);
        Ok(())
    }

    pub fn edit_note(
        ctx: Context<EditNote>,
        new_title: String,
        new_content: String,
    ) -> Result<()> {
        require!(
            ctx.accounts.author.key() == ctx.accounts.note.author,
            TellitError::NotAuthorized
        );
        require!(new_title.len() <= 50, TellitError::TitleTooLong);
        require!(new_content.len() <= 500, TellitError::ContentTooLong);

        let note = &mut ctx.accounts.note;
        note.title = new_title;
        note.content = new_content;
        note.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn react_to_note(
        ctx: Context<ReactToNote>,
        reaction_type: ReactionType,
    ) -> Result<()> {
        let note = &mut ctx.accounts.note;
        let reaction = &mut ctx.accounts.reaction;
        let reactor = ctx.accounts.reactor.key();

        match reaction_type {
            ReactionType::Like => {
                note.likes = note.likes.saturating_add(1);
                reaction.reaction_type = ReactionType::Like;
            }
            ReactionType::Dislike => {
                note.dislikes = note.dislikes.saturating_add(1);
                reaction.reaction_type = ReactionType::Dislike;
            }
            ReactionType::None => {
                return Err(TellitError::InvalidReactionType.into());
            }
        }
        reaction.reactor = reactor;
        reaction.note = note.key();
        reaction.bump = ctx.bumps.reaction;
        Ok(())
    }

    pub fn delete_note(ctx: Context<DeleteNote>) -> Result<()> {
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
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + 32 + 1 + 8, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SendNote<'info> {
    #[account(init, payer = author, space = 8 + 32 + 32 + 4 + 50 + 4 + 500 + 8 + 8 + 8 + 8 + 1, seeds = [b"note", author.key().as_ref(), receiver.key().as_ref()], bump)]
    pub note: Account<'info, Note>,
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub author: Signer<'info>,
    /// CHECK: This is the receiver of the note
    pub receiver: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EditNote<'info> {
    #[account(mut, seeds = [b"note", note.author.as_ref(), note.receiver.as_ref()], bump = note.bump, constraint = note.author == author.key() @ TellitError::NotAuthorized)]
    pub note: Account<'info, Note>,
    pub author: Signer<'info>,
}

#[derive(Accounts)]
pub struct ReactToNote<'info> {
    #[account(mut, seeds = [b"note", note.author.as_ref(), note.receiver.as_ref()], bump = note.bump)]
    pub note: Account<'info, Note>,
    #[account(init, payer = reactor, space = 8 + 32 + 32 + 1 + 1, seeds = [b"reaction", note.key().as_ref(), reactor.key().as_ref()], bump)]
    pub reaction: Account<'info, Reaction>,
    #[account(mut)]
    pub reactor: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DeleteNote<'info> {
    #[account(mut, close = deleter, seeds = [b"note", note.author.as_ref(), note.receiver.as_ref()], bump = note.bump)]
    pub note: Account<'info, Note>,
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub deleter: Signer<'info>,
}

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
    pub likes: u64,
    pub dislikes: u64,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
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

#[error_code]
pub enum TellitError {
    #[msg("Cannot send note to yourself")]
    CannotSendToSelf,
    #[msg("Title is too long (max 100 characters)")]
    TitleTooLong,
    #[msg("Content is too long (max 1000 characters)")]
    ContentTooLong,
    #[msg("Note already exists for this author-receiver pair")]
    NoteAlreadyExists,
    #[msg("Not authorized to perform this action")]
    NotAuthorized,
    #[msg("Invalid note PDA")]
    InvalidNotePDA,
    #[msg("Invalid reaction type")]
    InvalidReactionType,
}