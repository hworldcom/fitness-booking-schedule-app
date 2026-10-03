use anchor_lang::prelude::*;

use crate::errors::CoachPassError;

#[account]
#[derive(InitSpace)]
pub struct CoachAuthority {
    pub run_id: [u8; 16],
    pub profile_id: [u8; 16],
    pub original_wallet: Pubkey,
    pub current_wallet: Pubkey,
    pub recovery_authority: Pubkey,
    pub authority_epoch: u64,
    pub event_sequence: u64,
    pub bump: u8,
    pub reserved: [u8; 47],
}

impl CoachAuthority {
    pub fn initialize(
        run_id: [u8; 16],
        profile_id: [u8; 16],
        coach_wallet: Pubkey,
        recovery_authority: Pubkey,
        bump: u8,
    ) -> Result<Self> {
        require!(run_id != [0; 16], CoachPassError::NilRunId);
        require!(profile_id != [0; 16], CoachPassError::NilProfileId);
        require!(
            coach_wallet != Pubkey::default(),
            CoachPassError::InvalidCoachWallet
        );
        require!(
            recovery_authority != Pubkey::default(),
            CoachPassError::InvalidRecoveryAuthority
        );
        require_keys_neq!(
            coach_wallet,
            recovery_authority,
            CoachPassError::RecoveryAuthorityMatchesCoach
        );

        Ok(Self {
            run_id,
            profile_id,
            original_wallet: coach_wallet,
            current_wallet: coach_wallet,
            recovery_authority,
            authority_epoch: 0,
            event_sequence: 0,
            bump,
            reserved: [0; 47],
        })
    }

    pub fn rotate(&mut self, replacement_wallet: Pubkey) -> Result<(Pubkey, u64, u64)> {
        require!(
            replacement_wallet != Pubkey::default(),
            CoachPassError::InvalidReplacementWallet
        );
        require_keys_neq!(
            replacement_wallet,
            self.current_wallet,
            CoachPassError::ReplacementWalletUnchanged
        );
        require_keys_neq!(
            replacement_wallet,
            self.recovery_authority,
            CoachPassError::InvalidReplacementWallet
        );

        let previous_wallet = self.current_wallet;
        self.current_wallet = replacement_wallet;
        self.authority_epoch = self
            .authority_epoch
            .checked_add(1)
            .ok_or(CoachPassError::AuthorityEpochOverflow)?;
        let event_sequence = self.next_event_sequence()?;

        Ok((previous_wallet, self.authority_epoch, event_sequence))
    }

    pub fn next_event_sequence(&mut self) -> Result<u64> {
        self.event_sequence = self
            .event_sequence
            .checked_add(1)
            .ok_or(CoachPassError::EventSequenceOverflow)?;
        Ok(self.event_sequence)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initialization_rejects_nil_identifiers_and_invalid_authorities() {
        let coach = Pubkey::new_unique();
        let recovery = Pubkey::new_unique();

        assert!(CoachAuthority::initialize([0; 16], [1; 16], coach, recovery, 255).is_err());
        assert!(CoachAuthority::initialize([1; 16], [0; 16], coach, recovery, 255).is_err());
        assert!(
            CoachAuthority::initialize([1; 16], [2; 16], Pubkey::default(), recovery, 255).is_err()
        );
        assert!(CoachAuthority::initialize([1; 16], [2; 16], coach, coach, 255).is_err());
    }

    #[test]
    fn rotation_advances_epoch_and_preserves_stable_identity() {
        let coach = Pubkey::new_unique();
        let replacement = Pubkey::new_unique();
        let recovery = Pubkey::new_unique();
        let mut authority =
            CoachAuthority::initialize([1; 16], [2; 16], coach, recovery, 254).unwrap();

        let (previous, epoch, sequence) = authority.rotate(replacement).unwrap();

        assert_eq!(previous, coach);
        assert_eq!(authority.current_wallet, replacement);
        assert_eq!(authority.original_wallet, coach);
        assert_eq!(authority.authority_epoch, 1);
        assert_eq!(epoch, 1);
        assert_eq!(sequence, 1);
        assert_eq!(authority.run_id, [1; 16]);
        assert_eq!(authority.profile_id, [2; 16]);
        assert_eq!(authority.bump, 254);
    }

    #[test]
    fn rotation_rejects_noop_default_and_recovery_wallet() {
        let coach = Pubkey::new_unique();
        let recovery = Pubkey::new_unique();
        let mut authority =
            CoachAuthority::initialize([1; 16], [2; 16], coach, recovery, 254).unwrap();

        assert!(authority.rotate(coach).is_err());
        assert!(authority.rotate(Pubkey::default()).is_err());
        assert!(authority.rotate(recovery).is_err());
        assert_eq!(authority.current_wallet, coach);
        assert_eq!(authority.authority_epoch, 0);
    }
}
